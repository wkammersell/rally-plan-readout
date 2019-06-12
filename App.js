var app;
var UNALIGNED = 'Unaligned';

Ext.define('CustomApp', {
    extend: 'Rally.app.TimeboxScopedApp',
	scopeType: 'release',
    componentCls: 'app',
    launch: function() {
		app = this;
		app.callParent( arguments );
    },
	
	// If the scope changes, such as the release filter, update ourselves
	onScopeChange: function( scope ) {
		app.callParent( arguments );
		// Show loading message
		app._myMask = new Ext.LoadMask(Ext.getBody(), { msg: "Fetching Your Plan ... Please wait ..." } );
		app._myMask.show();
		
		var myScope = app.getContext().getTimeboxScope().getRecord();
		app.fetchPlanWork( myScope, 'UserStory' );
	},
	
	//TODO: Get Defects too
	fetchPlanWork: function( scope, model ) {
		console.log( 'Fetching plan ' + model + ' ...' );
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
				fetch: ['FormattedID','Name','Project','PortfolioItem','DisplayColor','Description'],
				context: app.getContext().getDataContext(),
				//TODO: Do we need to load more than 2000 items?
				pageSize: 2000,
				limit: 2000,
				sorters: [{
					property: 'rank',
				    direction: 'DESC'
				}]
			},
			app
		);
		
		store.addFilter( filters, false );
		var planMaps = [ {} ];
		var planMap = planMaps[ 0 ];
		var parentModel = null;
		planMap[ UNALIGNED + model ] = [];
		store.loadPage(1, {
			scope: app,
			callback: function( records, operation ) {
				if ( operation.wasSuccessful() ) {
					_.each( records, function( record ) {
						
						// TODO: Fetch Dependencies and Risks. See https://raw.githubusercontent.com/wkammersell/keep-or-sweep/master/App.js with Discussion loading for an example
						
						// Add story data to the lookup by feature
						if ( record.data.PortfolioItem ) {
							var parentID = record.data.PortfolioItem.FormattedID;
							if( planMap[ parentID ] === undefined ) {
								planMap[ parentID ] = record.data.PortfolioItem;
								planMap[ parentID ].Children = [];
							}
							planMap[ parentID ].Children.push( record.data );
							parentModel = record.data.PortfolioItem._type;
						} else {
							planMap[ UNALIGNED + model ].push( record.data );
						}
					}, app );
					if ( parentModel ) {
						planMap[ UNALIGNED + model ]._type = parentModel;
						console.log( planMaps);
						app.fetchPlanParent( scope, planMaps );
					} else {
						app.displayPlan( planMaps );
					}
				}
			}
		});	
	},
	
	fetchPlanParent: function( scope, planMaps ) {
		var model = planMaps[0][ Object.keys( planMaps[0] )[0] ]._type;
		console.log( 'Fetching ' + model + ' ...' );
		var currentMap = planMaps[ 0 ];
		planMaps.unshift( {} );
		var parentMap = planMaps[ 0 ];
		parentMap[ UNALIGNED + model ] = [];
		var outStandingLoads = 0;
		var parentModel = null;
		
		_.each( Object.keys( currentMap ), function( key ) {
			console.log( 'Fetching ' + key + ' ...' );
			
			var filters = [];
			var idFilter = Ext.create('Rally.data.wsapi.Filter', {
				property : 'FormattedID',
				operator: '=',
				value: key
			});
			filters.push( idFilter );
			
			var dataScope = {
				workspace: this.getContext().getWorkspaceRef(),
				project: null
			};
			
			var store = Ext.create(
				'Rally.data.wsapi.Store',
				{
					model: model,
					fetch: ['FormattedID','Name','Project','Parent','Description','DisplayColor'],
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
						
						currentMap[ record.data.FormattedID ].Name = record.data.Name;
						currentMap[ record.data.FormattedID ].Project = record.data.Project;
						currentMap[ record.data.FormattedID ].Parent = record.data.Parent;
						currentMap[ record.data.FormattedID ].Description = record.data.Description;
						currentMap[ record.data.FormattedID ].DisplayColor = record.data.DisplayColor;
						
						if( record.data.Parent ) {
							var parentID = record.data.Parent.FormattedID;
							if( parentMap[ parentID ] === undefined ) {
								parentMap[ parentID ] = record.data.Parent;
								parentMap[ parentID ].Children = [];
							}
							parentMap[ parentID ].Children.push( record.data );
							parentModel = record.data.Parent._type;
						} else {
							parentMap[ UNALIGNED + model ].push( record.data );
						}
					}
					
					outStandingLoads--;
					// See if we're done and can move on to the next loading
					if( outStandingLoads === 0 ) {
						// TODO Load Features Without Stories
						console.log( planMaps );
						if ( parentModel ) {
							parentMap[ UNALIGNED + model ]._type = parentModel;
							app.fetchPlanParent( scope, planMaps );
						} else {
							app.displayPlan( planMaps );							
						}
					}
				}
			});
		}, app );
	},
	
	clearContent:function() {
		while( app.down( 'label' ) ) {
			app.down( 'label' ).destroy();
		}
		while( app.down( 'button' ) ) {
			app.down( 'button' ).destroy();
		}
		while( app.down( 'container' ) ) {
			app.down( 'container' ).destroy();
		}
	},
	
	displayPlan:function( planMaps ) {
		app._myMask.hide();
		app.clearContent();
		
		var header = app.add( {
			xtype: 'container',
			border: 0,
			layout: {
				type: 'vbox',
				align: 'stretch'
			},
			bodyStyle: {
				'background-color': '#000000'
			},
		});
		
		header.add( {
			xtype: 'label',
			html: app.getContext().getProject().Name + ' Plan for ' + app.getContext().getTimeboxScope().getRecord().data.Name,
			padding: "0 0 0 10",
			style: {
				'font-size': '30px',
				'background-color': '#000000',
				'color': '#FFFFFF',
				'text-align': 'left'
			}	
		});
		
		_.each( planMaps[ 0 ][ Object.keys( planMaps[ 0 ] )[ 0 ] ], function( planItem ) {
			var model = planItem._type;
			if ( model.indexOf( '/' ) >= 0 ) {
				model = model.slice( model.indexOf( '/' ) + 1 );
			}
		
			var itemContainer = app.add( {
				xtype: 'container',
				border: 0,
				layout: {
					type: 'hbox',
					align: 'stretch'
				},
				bodyStyle: {
					'background-color': '#000000'
				}
			});
		
			itemContainer.add( {
				xtype: 'label',
				flex: 0,
				html: "___",
				style: {
					'font-size': '25px',
					'background-color': planItem.DisplayColor,
					'color': planItem.DisplayColor,
					'text-align': 'left'
				}	
			});
		
			var itemContentContainer = itemContainer.add( {
				xtype: 'container',
				flex: 1,
				border: 0,
				layout: {
					type: 'vbox',
					align: 'stretch'
				}
			});
		
			var itemTitleContainer = itemContentContainer.add( {
				xtype: 'container',
				flex: 1,
				border: 0,
				layout: {
					type: 'hbox',
					align: 'stretch'
				}
			});
		
			itemTitleContainer.add( {
				xtype: 'label',
				flex: 1,
				html: "Our " + model + " (" + planItem.FormattedID + ") " + planItem.Name,
				padding: "0 0 0 10",
				style: {
					'font-size': '25px',
					'background-color': '#000000',
					'color': '#FFFFFF',
					'text-align': 'left'
				}	
			});	
		
			itemContentContainer.add( {
				xtype: 'label',
				html: planItem.Description,
				padding: "0 0 0 10",
				style: {
					'font-size': '15px',
					'background-color': '#ffffff',
					'color': '#000000',
					'text-align': 'left'
				},
				height: '200px',
				autoScroll: true
			});
		
			app.displayChildren( planItem, planMaps, 1, itemContentContainer );
		}, app );
	},
	
	displayChildren:function( parent, planMaps, childDepth, container ) {	
		container.add( {
			xtype: 'label',
			html: "To achieve this, we are planning:",
			padding: "0 0 0 10",
			flex: 1,
			style: {
				'font-size': '25px',
				'background-color': '#000000',
				'color': '#FFFFFF',
				'text-align': 'left'
			}	
		});
		
		var children = planMaps[ childDepth ][ parent.FormattedID ].Children;
		_.each( children, function( child ) {
			var childContainer = container.add( {
				xtype: 'container',
				border: 0,
				layout: {
					type: 'hbox',
					align: 'stretch'
				},
				bodyStyle: {
					'background-color': '#000000'
				}
			});
		
			childContainer.add( {
				xtype: 'label',
				flex: 0,
				html: "___",
				style: {
					'font-size': '25px',
					'background-color': child.DisplayColor,
					'color': child.DisplayColor,
					'text-align': 'left'
				}	
			});
			
			var childContentContainer = childContainer.add( {
				xtype: 'container',
				flex: 1,
				border: 0,
				layout: {
					type: 'vbox',
					align: 'stretch'
				}
			});
		
			var childTitleContainer = childContentContainer.add( {
				xtype: 'container',
				flex: 1,
				border: 0,
				layout: {
					type: 'hbox',
					align: 'stretch'
				}
			});
			
			var model = child._type;
			if ( model.indexOf( '/' ) >= 0 ) {
				model = model.slice( model.indexOf( '/' ) + 1 );
			}
		
			childTitleContainer.add( {
				xtype: 'label',
				flex: 1,
				html: "Our " + model + " (" + child.FormattedID + ") " + child.Name,
				padding: "0 0 0 10",
				style: {
					'font-size': '25px',
					'background-color': '#000000',
					'color': '#FFFFFF',
					'text-align': 'left'
				}	
			});	
		
			childContentContainer.add( {
				xtype: 'label',
				html: child.Description,
				padding: "0 0 0 10",
				style: {
					'font-size': '15px',
					'background-color': '#ffffff',
					'color': '#000000',
					'text-align': 'left'
				},
				height: '200px',
				autoScroll: true
			});
			
			if ( childDepth < ( planMaps.length - 1 ) ) {
				app.displayChildren( child, planMaps, childDepth + 1, childContentContainer );
			}			
		}, app );
	}
});