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
		app._myMask = new Ext.LoadMask(Ext.getBody(), { msg: "Fetching Your Plan... Please wait." } );
		app._myMask.show();
		
		var scope = app.getContext().getTimeboxScope().getRecord();
		app.fetchStories( scope );
	},
	
	//TODO: Get Defects too
	fetchStories: function( scope ) {
		console.log( 'Fetching Stories..' );
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
		var storyToFeatureMap = {};
		storyToFeatureMap.Unaligned = [];
		store.loadPage(1, {
			scope: app,
			callback: function( records, operation ) {
				if( operation.wasSuccessful() ) {
					_.each( records, function( record ) {
						
						// TODO: Fetch Dependencies and Risks. See https://raw.githubusercontent.com/wkammersell/keep-or-sweep/master/App.js with Discussion loading for an example
						
						// Add story data to the lookup by feature
						if( record.data.Feature ) {
							if( storyToFeatureMap[ record.data.Feature.FormattedID ] === undefined ) {
								storyToFeatureMap[ record.data.Feature.FormattedID ] = [];
							}
							storyToFeatureMap[ record.data.Feature.FormattedID ].push( record.data );
						} else {
							storyToFeatureMap.Unaligned.push( record.data );
						}
						
						console.log( storyToFeatureMap );
					}, app );
					app.fetchStoriedFeatures( scope, storyToFeatureMap );
				}
			}
		});	
	},
	
	fetchStoriedFeatures: function( scope, storyToFeatureMap ) {
		console.log( 'Fetching Storied Features...' );
		var featureToSubObjectiveMap = {};
		featureToSubObjectiveMap.Unaligned = [];
		featureToSubObjectiveMap.Unaligned.push( { 'storyToFeatureMap': storyToFeatureMap[ 'Unaligned' ] } );
		
		_.each( Object.keys( storyToFeatureMap ), function( featureKey ) {
			console.log( 'Fetching ' + featureKey + ' ...' );
			var filters = [];
			var idFilter = Ext.create('Rally.data.wsapi.Filter', {
				property : 'FormattedID',
				operator: '=',
				value: featureKey
			});
			filters.push( idFilter );
			
			var store = Ext.create(
				'Rally.data.wsapi.Store',
				{
					model: 'PortfolioItem/Feature',
					fetch: ['FormattedID','Name','Project','Release','Parent'],
					context: app.getContext().getDataContext(),
					pageSize: 2000,
					limit: 2000
				},
				app
			);
			store.addFilter( filters, false );
			console.log( filters );
			
			store.loadPage(1, {
				scope: app,
				callback: function( records, operation ) {
					if( operation.wasSuccessful() && records.length > 0 ) {
						var record = records[ 0 ];
						console.log( record.data );
						record.data.storyToFeatureMap = storyToFeatureMap[ record.data.FormattedID ];
						if( record.data.Parent ) {
							if( featureToSubObjectiveMap[ record.data.Parent.FormattedID ] === undefined ) {
								featureToSubObjectiveMap[ record.data.Parent.FormattedID ] = [];
							}
							featureToSubObjectiveMap[ record.data.Parent.FormattedID ].push( record.data );
						} else {
							featureToSubObjectiveMap.Unaligned.push( record.data );
						}
						
						// See if we're done and can move on to the next loading
						if( featureToSubObjectiveMap.length == storyToFeatureMap.length ) {
							console.log( featureToSubObjectiveMap );
							console.log( 'NEXT!!!' )
						}
					}
				}
			});
		}, app );
	}
	
	// Load Features that have no Stories
	// Load Sub-Objectives for the Features
	// Load Sub-Objectives that have no Stories
	// Load Objectives for the Sub-Objectives
	// Load Objectives that have no Sub-Objectives
	// Display the awesomeness
});