import { createRoot } from '@wordpress/element';
import App from './App';
import './editor.scss';

const MOUNT_ID = 'page-annotator-editor-root';
const MOBILE_WIDTH = 390;

let currentRoot = null;

function openEditor() {
	if ( document.getElementById( MOUNT_ID ) ) {
		return;
	}

	const container = document.createElement( 'div' );
	container.id = MOUNT_ID;
	document.body.appendChild( container );

	const { target, postId, viewKey, pageUrl, restUrl, nonce } =
		window.pageAnnotator;
	const endpoint =
		target === 'view'
			? `annotations-view/${ viewKey }`
			: `annotations/${ postId }`;

	currentRoot = createRoot( container );
	currentRoot.render(
		<App
			endpoint={ endpoint }
			pageUrl={ pageUrl }
			restUrl={ restUrl }
			nonce={ nonce }
			mobileWidth={ MOBILE_WIDTH }
			onClose={ () => {
				currentRoot.unmount();
				currentRoot = null;
				container.remove();
			} }
		/>
	);
}

window.startAnnotate = openEditor;

if ( document.readyState === 'complete' || document.readyState === 'interactive' ) {
	openEditor();
} else {
	document.addEventListener( 'DOMContentLoaded', openEditor );
}
