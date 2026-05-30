import { useState, useRef, useEffect, useCallback } from '@wordpress/element';
import { catmullRomToBezier } from '../utils/smoothing';
import { computePathLength, generatePathId } from '../utils/svg';
import {
	startDrag,
	moveDrag,
	endDrag,
} from './PathManager';
import {
	startImageTransform,
	applyImageTransform,
	RESIZE_HANDLES,
} from './ImageManager';

export default function Canvas( {
	mode,
	breakpoint,
	allPaths,
	allImages,
	activeLayerId,
	layers,
	timeline,
	strokeColor,
	strokeWidth,
	selectedPathId,
	selectedImageId,
	viewBox,
	slotElement,
	frameRef,
	onAddPath,
	onAddTimeline,
	onSelectPath,
	onUpdatePath,
	onSelectImage,
	onUpdateImage,
	onSetViewBox,
	onPushUndo,
} ) {
	const svgRef = useRef( null );
	const isDrawingRef = useRef( false );
	const currentPointsRef = useRef( [] );
	const strokeStartTimeRef = useRef( 0 );
	const dragStateRef = useRef( null );
	const panStateRef = useRef( null );
	const isErasingRef = useRef( false );
	const erasePushedRef = useRef( false );
	const imgTransformRef = useRef( null );

	const [ currentStroke, setCurrentStroke ] = useState( null );
	const [ areaBox, setAreaBox ] = useState( null );
	const [ liveImage, setLiveImage ] = useState( null );

	useEffect( () => {
		if ( ! slotElement ) return undefined;

		// The iframe scroll is GSAP/ScrollTrigger-driven, so its window emits no
		// reliable scroll event. Poll the slot's rendered position each frame
		// instead, committing to state only when it moves. The first measure runs
		// synchronously because requestAnimationFrame is suspended while the tab
		// is hidden: without it the overlay would never position until focus.
		let rafId = 0;
		let isMounted = true;
		let lastTop = null;
		let lastLeft = null;
		let lastWidth = null;
		let lastHeight = null;

		function measure() {
			if ( ! isMounted ) return;
			const frameElement = frameRef.current;
			if ( ! frameElement ) {
				rafId = requestAnimationFrame( measure );
				return;
			}
			const slotRect = slotElement.getBoundingClientRect();
			const top = frameElement.offsetTop + slotRect.top;
			const left = frameElement.offsetLeft + slotRect.left;
			const sizeChanged =
				slotRect.width !== lastWidth || slotRect.height !== lastHeight;

			if ( top !== lastTop || left !== lastLeft || sizeChanged ) {
				lastTop = top;
				lastLeft = left;
				lastWidth = slotRect.width;
				lastHeight = slotRect.height;
				setAreaBox( {
					top,
					left,
					width: slotRect.width,
					height: slotRect.height,
				} );
				if ( sizeChanged ) {
					onSetViewBox( {
						width: slotRect.width,
						height: slotRect.height,
					} );
				}
			}

			rafId = requestAnimationFrame( measure );
		}

		measure();

		return () => {
			isMounted = false;
			if ( rafId ) cancelAnimationFrame( rafId );
		};
	}, [ slotElement, breakpoint, onSetViewBox, frameRef ] );

	useEffect( () => {
		const body = document.body;
		body.classList.remove( 'pa-draw-active', 'pa-select-active', 'pa-erase-active', 'pa-pan-active' );
		if ( mode === 'draw' ) body.classList.add( 'pa-draw-active' );
		else if ( mode === 'select' ) body.classList.add( 'pa-select-active' );
		else if ( mode === 'erase' ) body.classList.add( 'pa-erase-active' );
		else if ( mode === 'pan' ) body.classList.add( 'pa-pan-active' );
		return () => body.classList.remove( 'pa-draw-active', 'pa-select-active', 'pa-erase-active', 'pa-pan-active' );
	}, [ mode ] );

	useEffect( () => {
		function handleKeyDown( e ) {
			if ( mode !== 'select' || ( e.key !== 'Delete' && e.key !== 'Backspace' ) ) {
				return;
			}
			if ( selectedImageId ) {
				e.preventDefault();
				onPushUndo();
				onUpdateImage( selectedImageId, null );
				onSelectImage( null );
			} else if ( selectedPathId ) {
				e.preventDefault();
				onPushUndo();
				onUpdatePath( selectedPathId, null );
				onSelectPath( null );
			}
		}
		window.addEventListener( 'keydown', handleKeyDown );
		return () => window.removeEventListener( 'keydown', handleKeyDown );
	}, [ selectedPathId, selectedImageId, mode, onUpdatePath, onSelectPath, onUpdateImage, onSelectImage, onPushUndo ] );

	useEffect( () => {
		const svg = svgRef.current;
		if ( ! svg ) return;

		function getPointInSVG( e ) {
			const CTM = svg.getScreenCTM();
			if ( ! CTM ) return { x: e.clientX, y: e.clientY };
			const inverseCTM = CTM.inverse();
			const pt = svg.createSVGPoint();
			pt.x = e.clientX;
			pt.y = e.clientY;
			const transformed = pt.matrixTransform( inverseCTM );
			return {
				x: Math.round( transformed.x * 100 ) / 100,
				y: Math.round( transformed.y * 100 ) / 100,
			};
		}

		function eraseAtPoint( clientX, clientY ) {
			const el = document.elementFromPoint( clientX, clientY );
			if ( ! el || el.tagName !== 'path' || ! el.id ) return;
			const pathObj = allPaths.find( ( p ) => p.id === el.id );
			if ( ! pathObj ) return;
			if ( ! erasePushedRef.current ) {
				onPushUndo();
				erasePushedRef.current = true;
			}
			onUpdatePath( pathObj.id, null );
		}

		function onPointerDown( e ) {
			if ( e.target.closest( '.pa-bar-container' ) ) return;

			if ( mode === 'draw' ) {
				e.preventDefault();
				const point = getPointInSVG( e );
				currentPointsRef.current = [ { x: point.x, y: point.y, t: 0 } ];
				strokeStartTimeRef.current = Date.now();
				isDrawingRef.current = true;
				setCurrentStroke( { d: `M ${ point.x } ${ point.y }` } );
			} else if ( mode === 'select' ) {
					const handleEl = e.target.closest( '[data-pa-handle]' );
					if ( handleEl && selectedImageId ) {
						const imgObj = allImages.find( ( im ) => im.id === selectedImageId );
						if ( imgObj ) {
							const point = getPointInSVG( e );
							imgTransformRef.current = {
								id: imgObj.id,
								state: startImageTransform( imgObj, handleEl.getAttribute( 'data-pa-handle' ), point ),
								last: null,
							};
							e.preventDefault();
							return;
						}
					}

					const target = e.target;
					if ( target.tagName === 'image' && target.id ) {
						const imgObj = allImages.find( ( im ) => im.id === target.id );
						if ( imgObj ) {
							onSelectImage( imgObj.id );
							onSelectPath( null );
							const point = getPointInSVG( e );
							imgTransformRef.current = {
								id: imgObj.id,
								state: startImageTransform( imgObj, 'move', point ),
								last: null,
							};
							e.preventDefault();
							return;
						}
					}

					if ( target.tagName === 'path' && target.id ) {
						const pathObj = allPaths.find( ( p ) => p.id === target.id );
						if ( pathObj ) {
							onSelectPath( pathObj.id );
							onSelectImage( null );
							const point = getPointInSVG( e );
							dragStateRef.current = startDrag( pathObj, point );
							e.preventDefault();
						}
					} else {
						onSelectPath( null );
						onSelectImage( null );
					}
				} else if ( mode === 'erase' ) {
				e.preventDefault();
				isErasingRef.current = true;
				erasePushedRef.current = false;
				eraseAtPoint( e.clientX, e.clientY );
			} else if ( mode === 'pan' ) {
				const win = frameRef.current && frameRef.current.contentWindow;
				if ( win ) {
					e.preventDefault();
					panStateRef.current = {
						x: e.clientX,
						y: e.clientY,
						scrollX: win.scrollX,
						scrollY: win.scrollY,
					};
				}
			}
		}

		function onPointerMove( e ) {
			if ( mode === 'draw' && isDrawingRef.current ) {
				e.preventDefault();
				const point = getPointInSVG( e );
				const t = Date.now() - strokeStartTimeRef.current;
				currentPointsRef.current.push( { x: point.x, y: point.y, t } );
				const smoothedD = catmullRomToBezier( currentPointsRef.current );
				setCurrentStroke( { d: smoothedD } );
			} else if ( mode === 'select' && imgTransformRef.current ) {
					e.preventDefault();
					const point = getPointInSVG( e );
					const updates = applyImageTransform( imgTransformRef.current.state, point, { shiftKey: e.shiftKey } );
					if ( updates ) {
						imgTransformRef.current.last = updates;
						setLiveImage( { id: imgTransformRef.current.id, ...updates } );
					}
				} else if ( mode === 'select' && dragStateRef.current ) {
					e.preventDefault();
					const point = getPointInSVG( e );
					const newTransform = moveDrag( dragStateRef.current, point );
				const el = svg.querySelector( `#${ CSS.escape( dragStateRef.current.pathId ) }` );
				if ( el && newTransform ) el.setAttribute( 'transform', newTransform );
			} else if ( mode === 'erase' && isErasingRef.current ) {
				e.preventDefault();
				eraseAtPoint( e.clientX, e.clientY );
			} else if ( mode === 'pan' && panStateRef.current ) {
				e.preventDefault();
				const win = frameRef.current && frameRef.current.contentWindow;
				if ( win ) {
					const dx = e.clientX - panStateRef.current.x;
					const dy = e.clientY - panStateRef.current.y;
					win.scrollTo(
						panStateRef.current.scrollX - dx,
						panStateRef.current.scrollY - dy
					);
				}
			}
		}

		function onPointerUp() {
			if ( mode === 'draw' && isDrawingRef.current ) {
				isDrawingRef.current = false;
				const points = currentPointsRef.current;
				if ( points.length < 2 ) { setCurrentStroke( null ); return; }

				const finalD = catmullRomToBezier( points );
				const newId = generatePathId( allPaths );
				const order = allPaths.length;
				const pathLength = computePathLength( finalD );
				const strokeDuration = ( points[ points.length - 1 ].t / 1000 ).toFixed( 2 );

				const newPath = {
					id: newId,
					d: finalD,
					stroke: strokeColor,
					strokeWidth,
					transform: null,
					order,
					dataDuration: parseFloat( strokeDuration ) < 0.2 ? '0.3' : strokeDuration,
					dataDelay: '0',
					dashArray: pathLength,
					dashOffset: pathLength,
				};

				onPushUndo();
				onAddPath( newPath );
				onAddTimeline( newId, {
					points,
					startTime: strokeStartTimeRef.current,
					duration: points[ points.length - 1 ].t,
				} );
				setCurrentStroke( null );
			} else if ( mode === 'select' && imgTransformRef.current ) {
					const t = imgTransformRef.current;
					if ( t.last ) {
						onPushUndo();
						onUpdateImage( t.id, t.last );
					}
					imgTransformRef.current = null;
					setLiveImage( null );
				} else if ( mode === 'select' && dragStateRef.current ) {
					const finalTransform = endDrag( dragStateRef.current );
				if ( finalTransform !== undefined ) {
					onPushUndo();
					onUpdatePath( dragStateRef.current.pathId, { transform: finalTransform } );
				}
				dragStateRef.current = null;
			} else if ( mode === 'erase' ) {
				isErasingRef.current = false;
			} else if ( mode === 'pan' ) {
				panStateRef.current = null;
			}
		}

		function onPointerCancel() {
				imgTransformRef.current = null;
				setLiveImage( null );
			if ( isDrawingRef.current ) { isDrawingRef.current = false; setCurrentStroke( null ); }
			dragStateRef.current = null;
			panStateRef.current = null;
			isErasingRef.current = false;
		}

		function onTouchStart( e ) {
			if ( mode === 'draw' || mode === 'pan' || mode === 'erase' ) e.preventDefault();
		}

		svg.addEventListener( 'pointerdown', onPointerDown );
		svg.addEventListener( 'touchstart', onTouchStart, { passive: false } );
		document.addEventListener( 'pointermove', onPointerMove );
		document.addEventListener( 'pointerup', onPointerUp );
		document.addEventListener( 'pointercancel', onPointerCancel );

		return () => {
			svg.removeEventListener( 'pointerdown', onPointerDown );
			svg.removeEventListener( 'touchstart', onTouchStart );
			document.removeEventListener( 'pointermove', onPointerMove );
			document.removeEventListener( 'pointerup', onPointerUp );
			document.removeEventListener( 'pointercancel', onPointerCancel );
		};
	}, [ mode, allPaths, allImages, strokeColor, strokeWidth, selectedPathId, selectedImageId, onAddPath, onAddTimeline, onSelectPath, onUpdatePath, onSelectImage, onUpdateImage, onPushUndo, frameRef ] );

	const vb = viewBox || { width: 800, height: 400 };
	const areaStyle = areaBox
		? {
				top: areaBox.top + 'px',
				left: areaBox.left + 'px',
				width: areaBox.width + 'px',
				height: areaBox.height + 'px',
		  }
		: { display: 'none' };

	return (
		<div className="pa-canvas-area" style={ areaStyle }>
			<svg
				ref={ svgRef }
				className="pa-canvas-svg"
				xmlns="http://www.w3.org/2000/svg"
				viewBox={ `0 0 ${ vb.width } ${ vb.height }` }
				preserveAspectRatio="none"
			>
				{ allImages.map( ( img ) => {
					const g =
						liveImage && liveImage.id === img.id
							? { ...img, ...liveImage }
							: img;
					const transform = g.rotation
						? `rotate(${ g.rotation } ${ g.x + g.width / 2 } ${ g.y + g.height / 2 })`
						: undefined;
					return (
						<image
							key={ img.id }
							id={ img.id }
							href={ img.href }
							x={ g.x }
							y={ g.y }
							width={ g.width }
							height={ g.height }
							preserveAspectRatio="none"
							opacity={ img.opacity ?? 1 }
							transform={ transform }
							className={ selectedImageId === img.id ? 'pa-image-selected' : '' }
							style={ mode === 'select' ? { cursor: 'move' } : undefined }
						/>
					);
				} ) }
				{ allPaths.map( ( path ) => (
					<path
						key={ path.id }
						id={ path.id }
						d={ path.d }
						fill="none"
						stroke={ path.stroke }
						strokeWidth={ path.strokeWidth }
						strokeLinecap="round"
						strokeLinejoin="round"
						transform={ path.transform || undefined }
						className={ selectedPathId === path.id ? 'pa-path-selected' : '' }
						style={ mode === 'select' ? { cursor: 'pointer' } : undefined }
					/>
				) ) }
				{ currentStroke && (
					<path
						d={ currentStroke.d }
						fill="none"
						stroke={ strokeColor }
						strokeWidth={ strokeWidth }
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				) }
				{ mode === 'select' && selectedImageId && ( () => {
					const sel = allImages.find( ( im ) => im.id === selectedImageId );
					if ( ! sel ) {
						return null;
					}
					const g =
						liveImage && liveImage.id === sel.id
							? { ...sel, ...liveImage }
							: sel;
					const cx = g.x + g.width / 2;
					const cy = g.y + g.height / 2;
					const rotOffset = 28;
					const hs = 9;
					const handlePos = {
						nw: [ g.x, g.y ],
						n: [ cx, g.y ],
						ne: [ g.x + g.width, g.y ],
						e: [ g.x + g.width, cy ],
						se: [ g.x + g.width, g.y + g.height ],
						s: [ cx, g.y + g.height ],
						sw: [ g.x, g.y + g.height ],
						w: [ g.x, cy ],
					};
					return (
						<g
							className="pa-gizmo"
							transform={ g.rotation ? `rotate(${ g.rotation } ${ cx } ${ cy })` : undefined }
						>
							<rect className="pa-gizmo__box" x={ g.x } y={ g.y } width={ g.width } height={ g.height } />
							<line className="pa-gizmo__rot-arm" x1={ cx } y1={ g.y } x2={ cx } y2={ g.y - rotOffset } />
							<circle className="pa-gizmo__rot" data-pa-handle="rotate" cx={ cx } cy={ g.y - rotOffset } r={ hs / 2 + 1 } />
							{ RESIZE_HANDLES.map( ( h ) => (
								<rect
									key={ h }
									className="pa-gizmo__handle"
									data-pa-handle={ h }
									x={ handlePos[ h ][ 0 ] - hs / 2 }
									y={ handlePos[ h ][ 1 ] - hs / 2 }
									width={ hs }
									height={ hs }
								/>
							) ) }
						</g>
					);
				} )() }
			</svg>
		</div>
	);
}
