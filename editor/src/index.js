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

	currentRoot = createRoot( container );
	currentRoot.render(
		<App
			postId={ window.pageAnnotator.postId }
			pageUrl={ window.pageAnnotator.pageUrl }
			restUrl={ window.pageAnnotator.restUrl }
			nonce={ window.pageAnnotator.nonce }
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
