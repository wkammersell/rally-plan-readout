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
				fetch: ['FormattedID','Name','Project','PortfolioItem'],
				context: app.getContext().getDataContext(),
				//TODO: Do we need to load more than 2000 items?
				pageSize: 2000,
				limit: 2000
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
						app.displayPlan( planMaps, 0 );
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
						currentMap[ record.data.FormattedID ] = Object.assign( currentMap[ record.data.FormattedID ], record.data );
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
							app.displayPlan( planMaps, 0 );							
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
	
	displayPlan:function( planMaps, index ) {
		app._myMask.hide();
		app.clearContent();
		var planItem = planMaps[ 0 ][ Object.keys( planMaps[ 0 ] )[ 0 ] ][ index ];
		console.log(planItem);
		
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
		
		var grayScaleColor = ( index + 1 ) * Math.floor( 7 / planMaps.length );
		var bgColor = '#' + grayScaleColor + grayScaleColor + grayScaleColor + grayScaleColor + grayScaleColor + grayScaleColor;
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
				'background-color': bgColor
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
			html: "Our " + model + " is " + planItem.FormattedID + " - " + planItem.Name,
			padding: "0 0 0 10",
			style: {
				'font-size': '25px',
				'background-color': bgColor,
				'color': '#FFFFFF',
				'text-align': 'left'
			}	
		});
		
		//TODO: Factor in Unaligned items
		itemTitleContainer.add( {
			xtype: 'label',
			flex: 1,
			html: " ( " + ( index + 1 ) + " of " + ( planMaps[ 0 ][ Object.keys( planMaps[ 0 ] )[ 0 ] ].length ) + ")",
			padding: "0 20 0 0",
			style: {
				'font-size': '25px',
				'background-color': bgColor,
				'color': '#FFFFFF',
				'text-align': 'right'
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
		
		itemContentContainer.add( {
			xtype: 'label',
			html: "To achieve this we will:",
			flex: 1,
			style: {
				'font-size': '25px',
				'background-color': bgColor,
				'color': '#FFFFFF',
				'text-align': 'left'
			}	
		});
		
/*		_.each( objective.subObjectives, function( subObjective ) {
			subObjectivesBody.add( {
				xtype: 'label',
				html: subObjective.FormattedID + ' - ' + subObjective.Name,
				style: {
					'font-size': '25px',
					'background-color': '#6f74dd',
					'color': '#FFFFFF',
					'text-align': 'left'
				}	
			});
			
			subObjectivesBody.add( {
				xtype: 'label',
				html: subObjective.Description,
				style: {
					'font-size': '15px',
					'background-color': '#ffffff',
					'color': '#000000',
					'text-align': 'left'
				},
				height: '100px',
				autoScroll: true
			});
			
			var featuresContainer = subObjectivesBody.add( {
				xtype: 'container',
				border: 0,
				layout: {
					type: 'vbox',
					align: 'stretch'
				},
				bodyStyle: {
					'background-color': '#aaaaaa'
				},
				padding: '0 0 0 10'
			});
			
			featuresContainer.add( {
				xtype: 'label',
				html: "To achieve this goal, we will implement:",
				style: {
					'font-size': '25px',
					'background-color': '#aaaaaa',
					'color': '#000000',
					'text-align': 'left'
				}	
			}); 
			
			_.each( subObjective.features, function( feature ) {
				featuresContainer.add( {
					xtype: 'label',
					html: feature.FormattedID + ' - ' + feature.Name,
					style: {
						'font-size': '25px',
						'background-color': '#6f74dd',
						'color': '#FFFFFF',
						'text-align': 'left'
					}	
				});
			
				featuresContainer.add( {
					xtype: 'label',
					html: feature.Description,
					style: {
						'font-size': '15px',
						'background-color': '#ffffff',
						'color': '#000000',
						'text-align': 'left'
					},
					height: '100px',
					autoScroll: true	
				}); 
			}, app);
		}, app); */
		
	},
});