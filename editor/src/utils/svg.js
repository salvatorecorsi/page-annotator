/**
 * SVG generation, parsing, and path length utilities.
 * Layers are stored as <g> groups inside the SVG.
 */

export function computePathLength( d ) {
	if ( ! d ) {
		return 0;
	}
	const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
	const path = document.createElementNS( 'http://www.w3.org/2000/svg', 'path' );
	path.setAttribute( 'd', d );
	svg.appendChild( path );
	svg.style.position = 'absolute';
	svg.style.width = '0';
	svg.style.height = '0';
	svg.style.overflow = 'hidden';
	document.body.appendChild( svg );
	const length = path.getTotalLength();
	document.body.removeChild( svg );
	return length;
}

/**
 * Build SVG string from layers array.
 * Each layer becomes a <g> with id and data-name attributes.
 *
 * @param {Array}  layers  - Array of { id, name, paths: [...] }.
 * @param {Object} viewBox - { width, height }.
 * @return {string} Complete SVG markup.
 */
export function buildSvgString( layers, viewBox ) {
	if ( ! viewBox ) {
		return '';
	}

	const allPaths = layers.flatMap( ( l ) => l.paths );
	if ( allPaths.length === 0 ) {
		return '';
	}

	// Global path order counter for animation sequencing
	let globalOrder = 0;

	const groupElements = layers.map( ( layer ) => {
		const pathElements = layer.paths.map( ( p ) => {
			const pathLength = computePathLength( p.d );
			let delay = 0;
			// Cumulative delay based on global order
			for ( let i = 0; i < globalOrder; i++ ) {
				const prev = allPaths[ i ];
				if ( prev ) {
					delay += parseFloat( prev.dataDuration || '0.5' );
				}
			}

			const attrs = [
				`id="${ p.id }"`,
				`d="${ p.d }"`,
				`fill="none"`,
				`stroke="${ p.stroke }"`,
				`stroke-width="${ p.strokeWidth }"`,
				`stroke-linecap="round"`,
				`stroke-linejoin="round"`,
				`stroke-dasharray="${ pathLength.toFixed( 2 ) }"`,
				`stroke-dashoffset="${ pathLength.toFixed( 2 ) }"`,
				`data-duration="${ p.dataDuration || '0.8' }"`,
				`data-delay="${ delay.toFixed( 2 ) }"`,
				`data-order="${ globalOrder }"`,
			];

			if ( p.transform ) {
				attrs.push( `transform="${ p.transform }"` );
			}

			globalOrder++;
			return `    <path ${ attrs.join( ' ' ) } />`;
		} );

		return [
			`  <g id="${ layer.id }" data-name="${ escapeAttr( layer.name ) }">`,
			...pathElements,
			`  </g>`,
		].join( '\n' );
	} );

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ viewBox.width } ${ viewBox.height }" width="${ viewBox.width }" height="${ viewBox.height }" preserveAspectRatio="xMinYMin meet">`,
		...groupElements,
		`</svg>`,
	].join( '\n' );
}

function escapeAttr( str ) {
	return str.replace( /&/g, '&amp;' ).replace( /"/g, '&quot;' );
}

/**
 * Parse SVG string back into layers array.
 * Looks for <g> groups; paths not in a group go to a default layer.
 */
export function parseSvgToLayers( svgString ) {
	if ( ! svgString ) {
		return [];
	}

	const parser = new DOMParser();
	const doc = parser.parseFromString( svgString, 'image/svg+xml' );
	const svgEl = doc.querySelector( 'svg' );
	if ( ! svgEl ) {
		return [];
	}

	const layers = [];
	const groups = svgEl.querySelectorAll( ':scope > g' );

	if ( groups.length > 0 ) {
		groups.forEach( ( g ) => {
			const layer = {
				id: g.getAttribute( 'id' ) || `layer-${ layers.length + 1 }`,
				name: g.getAttribute( 'data-name' ) || `Layer ${ layers.length + 1 }`,
				paths: [],
			};
			g.querySelectorAll( 'path' ).forEach( ( el ) => {
				layer.paths.push( parsePathElement( el ) );
			} );
			layers.push( layer );
		} );
	} else {
		// Legacy: no groups, all paths in one layer
		const paths = svgEl.querySelectorAll( 'path' );
		if ( paths.length > 0 ) {
			const layer = {
				id: 'layer-001',
				name: 'Layer 1',
				paths: [],
			};
			paths.forEach( ( el ) => {
				layer.paths.push( parsePathElement( el ) );
			} );
			layers.push( layer );
		}
	}

	return layers;
}

function parsePathElement( el ) {
	return {
		id: el.getAttribute( 'id' ) || generateUniqueId(),
		d: el.getAttribute( 'd' ) || '',
		stroke: el.getAttribute( 'stroke' ) || '#000000',
		strokeWidth: parseFloat( el.getAttribute( 'stroke-width' ) ) || 4,
		transform: el.getAttribute( 'transform' ) || null,
		order: parseInt( el.getAttribute( 'data-order' ), 10 ) || 0,
		dataDuration: el.getAttribute( 'data-duration' ) || '0.8',
		dataDelay: el.getAttribute( 'data-delay' ) || '0',
		dashArray: parseFloat( el.getAttribute( 'stroke-dasharray' ) ) || 0,
		dashOffset: parseFloat( el.getAttribute( 'stroke-dashoffset' ) ) || 0,
	};
}

export function parseViewBoxFromSvg( svgString ) {
	if ( ! svgString ) {
		return null;
	}
	const match = svgString.match(
		/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/
	);
	if ( match ) {
		return {
			width: parseFloat( match[ 1 ] ),
			height: parseFloat( match[ 2 ] ),
		};
	}
	return null;
}

export function generatePathId( existingPaths ) {
	let maxNum = 0;
	for ( const p of existingPaths ) {
		const match = p.id.match( /annotation-path-(\d+)/ );
		if ( match ) {
			maxNum = Math.max( maxNum, parseInt( match[ 1 ], 10 ) );
		}
	}
	return `annotation-path-${ String( maxNum + 1 ).padStart( 3, '0' ) }`;
}

function generateUniqueId() {
	return `annotation-path-${ String( Math.floor( Math.random() * 999 ) + 1 ).padStart( 3, '0' ) }`;
}
