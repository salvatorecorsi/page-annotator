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
	const allImages = layers.flatMap( ( l ) => l.images || [] );
	if ( allPaths.length === 0 && allImages.length === 0 ) {
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

		const imageElements = ( layer.images || [] ).map( buildImageMarkup );

		return [
			`  <g id="${ layer.id }" data-name="${ escapeAttr( layer.name ) }">`,
			...imageElements,
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
	return String( str ).replace( /&/g, '&amp;' ).replace( /"/g, '&quot;' );
}

function round2( n ) {
	return Math.round( ( parseFloat( n ) || 0 ) * 100 ) / 100;
}

function buildImageMarkup( img ) {
	const attrs = [
		`id="${ img.id }"`,
		`href="${ escapeAttr( img.href ) }"`,
		`x="${ round2( img.x ) }"`,
		`y="${ round2( img.y ) }"`,
		`width="${ round2( img.width ) }"`,
		`height="${ round2( img.height ) }"`,
		`preserveAspectRatio="none"`,
	];

	const rotation = round2( img.rotation );
	if ( rotation ) {
		const cx = round2( img.x + img.width / 2 );
		const cy = round2( img.y + img.height / 2 );
		attrs.push( `transform="rotate(${ rotation } ${ cx } ${ cy })"` );
	}

	const opacity =
		img.opacity === undefined || img.opacity === null
			? 1
			: parseFloat( img.opacity );
	if ( opacity !== 1 ) {
		attrs.push( `opacity="${ round2( opacity ) }"` );
	}

	return `    <image ${ attrs.join( ' ' ) } />`;
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
				images: [],
			};
			g.querySelectorAll( 'image' ).forEach( ( el ) => {
				layer.images.push( parseImageElement( el ) );
			} );
			g.querySelectorAll( 'path' ).forEach( ( el ) => {
				layer.paths.push( parsePathElement( el ) );
			} );
			layers.push( layer );
		} );
	} else {
		// Legacy: no groups, all paths in one layer
		const paths = svgEl.querySelectorAll( 'path' );
		const images = svgEl.querySelectorAll( 'image' );
		if ( paths.length > 0 || images.length > 0 ) {
			const layer = {
				id: 'layer-001',
				name: 'Layer 1',
				paths: [],
				images: [],
			};
			images.forEach( ( el ) => {
				layer.images.push( parseImageElement( el ) );
			} );
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

function parseImageElement( el ) {
	let rotation = 0;
	const transform = el.getAttribute( 'transform' );
	if ( transform ) {
		const m = transform.match( /rotate\(\s*([-\d.]+)/ );
		if ( m ) {
			rotation = parseFloat( m[ 1 ] ) || 0;
		}
	}

	const opacityAttr = el.getAttribute( 'opacity' );
	const href =
		el.getAttribute( 'href' ) ||
		el.getAttributeNS( 'http://www.w3.org/1999/xlink', 'href' ) ||
		'';

	return {
		id: el.getAttribute( 'id' ) || generateUniqueImageId(),
		href,
		x: parseFloat( el.getAttribute( 'x' ) ) || 0,
		y: parseFloat( el.getAttribute( 'y' ) ) || 0,
		width: parseFloat( el.getAttribute( 'width' ) ) || 0,
		height: parseFloat( el.getAttribute( 'height' ) ) || 0,
		rotation,
		opacity: opacityAttr !== null ? parseFloat( opacityAttr ) : 1,
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

export function generateImageId( existingImages ) {
	let maxNum = 0;
	for ( const img of existingImages ) {
		const match = img.id.match( /annotation-image-(\d+)/ );
		if ( match ) {
			maxNum = Math.max( maxNum, parseInt( match[ 1 ], 10 ) );
		}
	}
	return `annotation-image-${ String( maxNum + 1 ).padStart( 3, '0' ) }`;
}

function generateUniqueImageId() {
	return `annotation-image-${ String( Math.floor( Math.random() * 999 ) + 1 ).padStart( 3, '0' ) }`;
}
