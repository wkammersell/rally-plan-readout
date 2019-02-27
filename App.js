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
		app.callParent( arguments );
    },
	
	// If the scope changes, such as the release filter, update ourselves
	onScopeChange: function( scope ) {
		app.callParent( arguments );
		// Show loading message
		app._myMask = new Ext.LoadMask(Ext.getBody(), {msg:"Fetching Your Plan... Please wait."});
		app._myMask.show();
		var scope = app.getContext().getTimeboxScope().getRecord();
		app.fetchStories( scope );
	},
	
	fetchStories: function( scope ) {
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
				fetch: ['FormattedID','Name','Project','Release','Feature'],
				context: app.getContext().getDataContext(),
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
						var storyDetails = {};
						storyDetails.name = record.data.Name;
						storyDetails.formattedID = record.data.FormattedID;
						
						if( record.data.Feature ) {
							if( storyToFeatureMap[ record.data.Feature._ref ] === undefined ) {
								storyToFeatureMap[ record.data.Feature._ref ] = [];
							}
							storyToFeatureMap[ record.data.Feature._ref ].push( storyDetails );
						} else {
							storyToFeatureMap.Unaligned.push( storyDetails );
						}
						
						console.log( storyToFeatureMap );
					}, app );
				}
			}
		});	
	}
});