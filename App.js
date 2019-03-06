Ext.define('CustomApp', {
    extend: 'Rally.app.TimeboxScopedApp',
	scopeType: 'release',
    componentCls: 'app',
	app: null,
    launch: function() {
		app = this;
		// Track if this is the first launch so we should auto-load from prefs
		app.firstLaunch = true;
		filterContainer = app.down( 'container' );
		contentContainer = app.add( {
			xype: 'box',
			border: 0
		});
		//TODO Fetch Portfolio Item Types
		app.callParent( arguments );
    },
	
	// If the scope changes, such as the release filter, update ourselves
	onScopeChange: function( scope ) {
		app.callParent( arguments );
		// Show loading message
		app._myMask = new Ext.LoadMask(Ext.getBody(), { msg: "Fetching Your Plan ... Please wait." } );
		app._myMask.show();
		
		var scope = app.getContext().getTimeboxScope().getRecord();
		app.fetchStories( scope );
	},
	
	//TODO: Get Defects too
	fetchStories: function( scope ) {
		console.log( 'Fetching Stories ...' );
		var filters = [];
		var releaseFilter = Ext.create('Rally.data.wsapi.Filter', {
			property : 'Release',
			operator: '=',
			value: scope.get('_ref')
		});
		filters.push( releaseFilter );

		var store = Ext.create(
			'Rally.data.wsapi.Store',
			{
				model: 'UserStory',
				fetch: ['FormattedID','Name','Project','Feature'],
				context: app.getContext().getDataContext(),
				//TODO: Do we need to load more than 2000 items?
				pageSize: 2000,
				limit: 2000
			},
			app
		);
		
		store.addFilter( filters, false );
		var featureStoryMap = {};
		featureStoryMap.Unaligned = [];
		store.loadPage(1, {
			scope: app,
			callback: function( records, operation ) {
				if( operation.wasSuccessful() ) {
					_.each( records, function( record ) {
						
						// TODO: Fetch Dependencies and Risks. See https://raw.githubusercontent.com/wkammersell/keep-or-sweep/master/App.js with Discussion loading for an example
						
						// Add story data to the lookup by feature
						if( record.data.Feature ) {
							if( featureStoryMap[ record.data.Feature.FormattedID ] === undefined ) {
								featureStoryMap[ record.data.Feature.FormattedID ] = [];
							}
							featureStoryMap[ record.data.Feature.FormattedID ].push( record.data );
						} else {
							featureStoryMap.Unaligned.push( record.data );
						}
					}, app );
					console.log('Feature Map');
					console.log( featureStoryMap );
					app.fetchStoriedFeatures( scope, featureStoryMap );
				}
			}
		});	
	},
	
	fetchStoriedFeatures: function( scope, featureStoryMap ) {
		console.log( 'Fetching Storied Features ...' );
		var subObjectiveFeatureMap = {};
		subObjectiveFeatureMap.Unaligned = [];
		subObjectiveFeatureMap.Unaligned.push( { 'Unaligned': featureStoryMap[ 'Unaligned' ] } );
		var outStandingLoads = 0;
		
		_.each( Object.keys( featureStoryMap ), function( featureKey ) {
			console.log( 'Fetching ' + featureKey + ' ...' );
			
			var filters = [];
			var idFilter = Ext.create('Rally.data.wsapi.Filter', {
				property : 'FormattedID',
				operator: '=',
				value: featureKey
			});
			filters.push( idFilter );
			
			var dataScope = {
				workspace: this.getContext().getWorkspaceRef(),
				project: null
			};
			
			var store = Ext.create(
				'Rally.data.wsapi.Store',
				{
					model: 'PortfolioItem/Feature',
					fetch: ['FormattedID','Name','Project','Release','Parent'],
					context: dataScope,
					pageSize: 2000,
					limit: 2000
				},
				app
			);
			store.addFilter( filters, false );
			
			outStandingLoads++;
			store.loadPage(1, {
				scope: app,
				callback: function( records, operation ) {
					if( operation.wasSuccessful() && records.length > 0 ) {
						var record = records[ 0 ];
						console.log( record.data );
						record.data.stories = featureStoryMap[ record.data.FormattedID ];
						if( record.data.Parent ) {
							if( subObjectiveFeatureMap[ record.data.Parent.FormattedID ] === undefined ) {
								subObjectiveFeatureMap[ record.data.Parent.FormattedID ] = [];
							}
							subObjectiveFeatureMap[ record.data.Parent.FormattedID ].push( record.data );
						} else {
							subObjectiveFeatureMap.Unaligned.push( record.data );
						}
					}
					
					outStandingLoads--;
					// See if we're done and can move on to the next loading
					if( outStandingLoads == 0 ) {
						console.log( 'Sub Objective Map');
						console.log( subObjectiveFeatureMap )
						// TODO Load Features Without Stories
						// app.fetchFeaturesWithoutStories( scope, featureToSubObjectiveMap );
						app.fetchFeaturedSubObjectives( scope, subObjectiveFeatureMap );
					}
				}
			});
		}, app );
	},
	
	// Load Sub-Objectives for the Features
	fetchFeaturedSubObjectives: function( scope, subObjectiveFeatureMap ) {
		console.log( 'Fetching Featured Sub Objectives ...' );
		var objectiveSubObjectiveMap = {};
		objectiveSubObjectiveMap.Unaligned = [];
		objectiveSubObjectiveMap.Unaligned.push( { 'Unaligned': subObjectiveFeatureMap[ 'Unaligned' ] } );
		var outStandingLoads = 0;
		
		_.each( Object.keys( subObjectiveFeatureMap ), function( subObjectiveKey ) {
			console.log( 'Fetching ' + subObjectiveKey + ' ...' );
			var filters = [];
			var idFilter = Ext.create('Rally.data.wsapi.Filter', {
				property : 'FormattedID',
				operator: '=',
				value: subObjectiveKey
			});
			filters.push( idFilter );
			
			var dataScope = {
				workspace: this.getContext().getWorkspaceRef(),
				project: null
			};
			
			var store = Ext.create(
				'Rally.data.wsapi.Store',
				{
					model: 'PortfolioItem/Initiative',
					fetch: ['FormattedID','Name','Project','Parent'],
					context: dataScope,
					pageSize: 2000,
					limit: 2000
				},
				app
			);
			store.addFilter( filters, false );
			
			outStandingLoads++;
			store.loadPage(1, {
				scope: app,
				callback: function( records, operation ) {
					if( operation.wasSuccessful() && records.length > 0 ) {
						var record = records[ 0 ];
						console.log( record.data );
						record.data.features = subObjectiveFeatureMap[ record.data.FormattedID ];
						if( record.data.Parent ) {
							if( objectiveSubObjectiveMap[ record.data.Parent.FormattedID ] === undefined ) {
								objectiveSubObjectiveMap[ record.data.Parent.FormattedID ] = [];
							}
							objectiveSubObjectiveMap[ record.data.Parent.FormattedID ].push( record.data );
						} else {
							objectiveSubObjectiveMap.Unaligned.push( record.data );
						}
					}
					
					outStandingLoads--;
					// See if we're done and can move on to the next loading
					if( outStandingLoads == 0 ) {
						console.log( 'Sub Objective Map');
						console.log( objectiveSubObjectiveMap );
						// TODO Load Features Without Stories
						// app.fetchFeaturesWithoutStories( scope, featureToSubObjectiveMap );
						app.fetchSubObjectivedObjectives( scope, objectiveSubObjectiveMap );
					}
				}
			});
		}, app );
	},
	
	// Load Objectives for the Sub-Objectives
	fetchSubObjectivedObjectives: function( scope, objectiveSubObjectiveMap ) {
		console.log( 'Fetching Sub Objectived Objectives ...' );
		var objectives = [];
		objectives.push( objectiveSubObjectiveMap[ 'Unaligned' ] );
		var outStandingLoads = 0;
		
		_.each( Object.keys( objectiveSubObjectiveMap ), function( objectiveKey ) {
			console.log( 'Fetching ' + objectiveKey + ' ...' );
			var filters = [];
			var idFilter = Ext.create('Rally.data.wsapi.Filter', {
				property : 'FormattedID',
				operator: '=',
				value: objectiveKey
			});
			filters.push( idFilter );
			
			var dataScope = {
				workspace: this.getContext().getWorkspaceRef(),
				project: null
			};
			
			var store = Ext.create(
				'Rally.data.wsapi.Store',
				{
					model: 'PortfolioItem/Theme',
					fetch: ['FormattedID','Name','Project'],
					context: dataScope,
					pageSize: 2000,
					limit: 2000
				},
				app
			);
			store.addFilter( filters, false );
			
			outStandingLoads++;
			store.loadPage(1, {
				scope: app,
				callback: function( records, operation ) {
					if( operation.wasSuccessful() && records.length > 0 ) {
						var record = records[ 0 ];
						console.log( record.data );
						record.data.subObjectives = objectiveSubObjectiveMap[ record.data.FormattedID ];
						objectives.push( record.data );
					}
					
					outStandingLoads--;
					// See if we're done and can move on to the next loading
					if( outStandingLoads == 0 ) {
						console.log( 'Objectives');
						console.log( objectives );
						// TODO Load Features Without Stories
						// app.fetchFeaturesWithoutStories( scope, featureToSubObjectiveMap );
						//app.fetchSubOjbectivedObjectives( scope, featureToSubObjectiveMap );
					}
				}
			});
		}, app );
	},
	
	/*// Load Features that have no Stories
	fetchFeaturesWithoutStories: function( scope, featureToSubObjectiveMap ) {
		console.log( 'Fetching Features Without Stories ...' );
		var filters = [];
		var releaseFilter = Ext.create('Rally.data.wsapi.Filter', {
			property : 'Release',
			operator: '=',
			value: scope.get('_ref')
		});
		filters.push( releaseFilter );

		var store = Ext.create(
			'Rally.data.wsapi.Store',
			{
				model: 'PortfolioItem/Feature',
				fetch: ['FormattedID','Name','Project','Feature','Release'],
				context: app.getContext().getDataContext(),
				//TODO: Do we need to load more than 2000 items?
				pageSize: 2000,
				limit: 2000
			},
			app
		);
		
		store.addFilter( filters, false );
		store.loadPage(1, {
			scope: app,
			callback: function( records, operation ) {
				if( operation.wasSuccessful() ) {
					_.each( records, function( record ) {
						
						// TODO: Fetch Dependencies and Risks. See https://raw.githubusercontent.com/wkammersell/keep-or-sweep/master/App.js with Discussion loading for an example
						
						if( record.data.Parent ) {
							if( featureToSubObjectiveMap[ record.data.Parent.FormattedID ] === undefined ) {
								featureToSubObjectiveMap[ record.data.Parent.FormattedID ] = [];
							}
							featureToSubObjectiveMap[ record.data.Feature.FormattedID ].push( record.data );
						} else {
							featureToSubObjectiveMap.Unaligned.push( record.data );
						}
					}, app );
					console.log('NEXT!!!');
				}
			}
		});	
	}*/
	
	// Load Sub-Objectives that have no Stories
	// Load Objectives for the Sub-Objectives
	// Load Objectives that have no Sub-Objectives
	// Display the awesomeness
});