( function ( plugins, editPost, element, data, components ) {
	'use strict';

	var el = element.createElement;
	var registerPlugin = plugins.registerPlugin;
	var PluginPostStatusInfo = editPost.PluginPostStatusInfo;
	var useSelect = data.useSelect;
	var Button = components.Button;

	registerPlugin( 'page-annotator-button', {
		render: function () {
			var permalink = useSelect( function ( select ) {
				return select( 'core/editor' ).getPermalink();
			} );

			if ( ! permalink ) {
				return null;
			}

			var separator = permalink.indexOf( '?' ) !== -1 ? '&' : '?';
			var url = permalink + separator + 'annotation=true';

			return el(
				PluginPostStatusInfo,
				{ className: 'page-annotator-status-info' },
				el(
					Button,
					{
						variant: 'secondary',
						href: url,
						target: '_blank',
						style: { width: '100%', justifyContent: 'center' },
						icon: 'edit',
					},
					'Aggiungi annotazioni'
				)
			);
		},
	} );
} )(
	wp.plugins,
	wp.editPost,
	wp.element,
	wp.data,
	wp.components
);
