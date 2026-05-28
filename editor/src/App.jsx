import { useState, useEffect, useCallback, useRef, useMemo } from '@wordpress/element';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import {
	buildSvgString,
	parseSvgToLayers,
	parseViewBoxFromSvg,
} from './utils/svg';

const ROLES = [ 'cover', 'scribbles' ];
const BREAKPOINTS = [ 'desktop', 'mobile' ];

let layerCounter = 0;
function nextLayerId() {
	layerCounter++;
	return `layer-${ String( layerCounter ).padStart( 3, '0' ) }`;
}

function createLayer( name, paths = [] ) {
	return { id: nextLayerId(), name, paths };
}

function emptyRoleBpMap( factory ) {
	const out = {};
	for ( const role of ROLES ) {
		out[ role ] = {};
		for ( const bp of BREAKPOINTS ) {
			out[ role ][ bp ] = factory();
		}
	}
	return out;
}

function buildSvgPayload( layersState, viewBoxState ) {
	const out = {};
	for ( const role of ROLES ) {
		out[ role ] = {
			desktop: buildSvgString(
				layersState[ role ].desktop,
				viewBoxState[ role ].desktop
			),
			mobile: buildSvgString(
				layersState[ role ].mobile,
				viewBoxState[ role ].mobile
			),
		};
	}
	return out;
}

const PREVIEW_PARAM = 'page_annotator_preview';

function buildPreviewUrl( url ) {
	const sep = url.indexOf( '?' ) === -1 ? '?' : '&';
	return `${ url }${ sep }${ PREVIEW_PARAM }=1`;
}

export default function App( {
	postId,
	pageUrl,
	restUrl,
	nonce,
	mobileWidth,
	onClose,
} ) {
	const frameRef = useRef( null );
	const previewUrl = useMemo( () => buildPreviewUrl( pageUrl ), [ pageUrl ] );

	const [ slots, setSlots ] = useState( {} );
	const [ frameReady, setFrameReady ] = useState( false );
	const availableRoles = useMemo(
		() => ROLES.filter( ( r ) => slots[ r ] ),
		[ slots ]
	);

	const [ role, setRole ] = useState( 'cover' );
	const [ breakpoint, setBreakpoint ] = useState( 'desktop' );
	const [ mode, setMode ] = useState( 'draw' );
	const [ strokeColor, setStrokeColor ] = useState( '#000000' );
	const [ strokeWidth, setStrokeWidth ] = useState( 4 );

	const [ layers, setLayers ] = useState( () =>
		emptyRoleBpMap( () => [ createLayer( 'Layer 1' ) ] )
	);
	const [ activeLayerId, setActiveLayerId ] = useState( () =>
		emptyRoleBpMap( () => null )
	);
	const [ timeline, setTimeline ] = useState( () =>
		emptyRoleBpMap( () => ( {} ) )
	);
	const [ viewBox, setViewBox ] = useState( () =>
		emptyRoleBpMap( () => null )
	);

	const [ selectedPathId, setSelectedPathId ] = useState( null );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ saveStatus, setSaveStatus ] = useState( null );
	const [ isLoading, setIsLoading ] = useState( true );
	const undoStackRef = useRef( [] );
	const [ undoCount, setUndoCount ] = useState( 0 );

	const currentActiveLayerId = activeLayerId[ role ][ breakpoint ];
	const allCurrentPaths = ( layers[ role ][ breakpoint ] || [] ).flatMap(
		( l ) => l.paths
	);

	const handleToggleBreakpoint = useCallback( () => {
		setBreakpoint( ( bp ) => ( bp === 'desktop' ? 'mobile' : 'desktop' ) );
	}, [] );

	const handleToggleRole = useCallback( () => {
		setRole( ( prev ) => {
			const idx = availableRoles.indexOf( prev );
			return availableRoles[ ( idx + 1 ) % availableRoles.length ];
		} );
	}, [ availableRoles ] );

	const handleFrameLoad = useCallback( () => {
		const frame = frameRef.current;
		const doc = frame && frame.contentDocument;
		if ( ! doc ) {
			return;
		}
		const found = {};
		for ( const r of ROLES ) {
			found[ r ] = doc.querySelector( `[data-pa-slot="${ r }"]` );
		}
		setSlots( found );
		setRole( ( prev ) =>
			found[ prev ] ? prev : ROLES.find( ( r ) => found[ r ] ) || prev
		);
		setFrameReady( true );
	}, [] );

	// The preview iframe scrolls internally; forward wheel from the overlay to it.
	useEffect( () => {
		if ( ! frameReady ) {
			return undefined;
		}
		function onWheel( e ) {
			if ( e.target.closest && e.target.closest( '.pa-bar-container' ) ) {
				return;
			}
			const win = frameRef.current && frameRef.current.contentWindow;
			if ( ! win ) {
				return;
			}
			e.preventDefault();
			win.scrollBy( 0, e.deltaY );
		}
		document.addEventListener( 'wheel', onWheel, { passive: false } );
		return () => document.removeEventListener( 'wheel', onWheel );
	}, [ frameReady ] );

	// Ensure every role/breakpoint slice has an active layer.
	useEffect( () => {
		setActiveLayerId( ( prev ) => {
			let changed = false;
			const next = {};
			for ( const r of ROLES ) {
				next[ r ] = { ...prev[ r ] };
				for ( const bp of BREAKPOINTS ) {
					if ( ! next[ r ][ bp ] && layers[ r ][ bp ].length > 0 ) {
						next[ r ][ bp ] = layers[ r ][ bp ][ 0 ].id;
						changed = true;
					}
				}
			}
			return changed ? next : prev;
		} );
	}, [ layers ] );

	useEffect( () => {
		fetch( `${ restUrl }annotations/${ postId }`, {
			headers: { 'X-WP-Nonce': nonce },
		} )
			.then( ( res ) => res.json() )
			.then( ( data ) => {
				if ( data.svg ) {
					const parsedByRole = {};
					for ( const r of ROLES ) {
						parsedByRole[ r ] = {};
						for ( const bp of BREAKPOINTS ) {
							const svgStr =
								( data.svg[ r ] && data.svg[ r ][ bp ] ) || '';
							const parsed = parseSvgToLayers( svgStr );
							for ( const l of parsed ) {
								const m = l.id.match( /layer-(\d+)/ );
								if ( m ) {
									layerCounter = Math.max(
										layerCounter,
										parseInt( m[ 1 ], 10 )
									);
								}
							}
							parsedByRole[ r ][ bp ] = {
								parsed,
								viewBox: parseViewBoxFromSvg( svgStr ),
							};
						}
					}

					const newLayers = {};
					const newActive = {};
					const newViewBox = {};
					for ( const r of ROLES ) {
						newLayers[ r ] = {};
						newActive[ r ] = {};
						newViewBox[ r ] = {};
						for ( const bp of BREAKPOINTS ) {
							const slice = parsedByRole[ r ][ bp ];
							const ls =
								slice.parsed.length > 0
									? slice.parsed
									: [ createLayer( 'Layer 1' ) ];
							newLayers[ r ][ bp ] = ls;
							newActive[ r ][ bp ] = ls[ 0 ].id;
							newViewBox[ r ][ bp ] = slice.viewBox;
						}
					}

					setLayers( newLayers );
					setActiveLayerId( newActive );
					setViewBox( newViewBox );
				}

				if ( data.timeline && typeof data.timeline === 'object' ) {
					const tl = {};
					for ( const r of ROLES ) {
						tl[ r ] = {
							desktop:
								( data.timeline[ r ] &&
									data.timeline[ r ].desktop ) ||
								{},
							mobile:
								( data.timeline[ r ] &&
									data.timeline[ r ].mobile ) ||
								{},
						};
					}
					setTimeline( tl );
				}

				setIsLoading( false );
			} )
			.catch( () => {
				setIsLoading( false );
			} );
	}, [ postId, restUrl, nonce ] );

	const updateLayersSlice = useCallback(
		( updater ) => {
			setLayers( ( prev ) => ( {
				...prev,
				[ role ]: {
					...prev[ role ],
					[ breakpoint ]: updater( prev[ role ][ breakpoint ] ),
				},
			} ) );
		},
		[ role, breakpoint ]
	);

	const updateTimelineSlice = useCallback(
		( updater ) => {
			setTimeline( ( prev ) => ( {
				...prev,
				[ role ]: {
					...prev[ role ],
					[ breakpoint ]: updater( prev[ role ][ breakpoint ] ),
				},
			} ) );
		},
		[ role, breakpoint ]
	);

	const setActiveLayerForCurrent = useCallback(
		( id ) => {
			setActiveLayerId( ( prev ) => ( {
				...prev,
				[ role ]: { ...prev[ role ], [ breakpoint ]: id },
			} ) );
		},
		[ role, breakpoint ]
	);

	const pushUndo = useCallback( () => {
		undoStackRef.current.push( {
			role,
			breakpoint,
			layers: JSON.parse(
				JSON.stringify( layers[ role ][ breakpoint ] )
			),
			timeline: JSON.parse(
				JSON.stringify( timeline[ role ][ breakpoint ] )
			),
			activeLayerId: currentActiveLayerId,
		} );
		if ( undoStackRef.current.length > 50 ) {
			undoStackRef.current.shift();
		}
		setUndoCount( undoStackRef.current.length );
	}, [ layers, timeline, role, breakpoint, currentActiveLayerId ] );

	const handleUndo = useCallback( () => {
		if ( undoStackRef.current.length === 0 ) {
			return;
		}
		const prev = undoStackRef.current.pop();
		setLayers( ( l ) => ( {
			...l,
			[ prev.role ]: {
				...l[ prev.role ],
				[ prev.breakpoint ]: prev.layers,
			},
		} ) );
		setTimeline( ( t ) => ( {
			...t,
			[ prev.role ]: {
				...t[ prev.role ],
				[ prev.breakpoint ]: prev.timeline,
			},
		} ) );
		setActiveLayerId( ( a ) => ( {
			...a,
			[ prev.role ]: {
				...a[ prev.role ],
				[ prev.breakpoint ]: prev.activeLayerId,
			},
		} ) );
		setSelectedPathId( null );
		setUndoCount( undoStackRef.current.length );
	}, [] );

	const handleAddPath = useCallback(
		( newPath ) => {
			updateLayersSlice( ( ls ) =>
				ls.map( ( layer ) =>
					layer.id === currentActiveLayerId
						? { ...layer, paths: [ ...layer.paths, newPath ] }
						: layer
				)
			);
		},
		[ updateLayersSlice, currentActiveLayerId ]
	);

	const handleAddTimeline = useCallback(
		( pathId, data ) => {
			updateTimelineSlice( ( tl ) => ( { ...tl, [ pathId ]: data } ) );
		},
		[ updateTimelineSlice ]
	);

	const handleUpdatePath = useCallback(
		( pathId, updates ) => {
			updateLayersSlice( ( ls ) =>
				ls.map( ( layer ) => {
					if ( ! layer.paths.some( ( p ) => p.id === pathId ) ) {
						return layer;
					}
					if ( updates === null ) {
						return {
							...layer,
							paths: layer.paths.filter(
								( p ) => p.id !== pathId
							),
						};
					}
					return {
						...layer,
						paths: layer.paths.map( ( p ) =>
							p.id === pathId ? { ...p, ...updates } : p
						),
					};
				} )
			);
			if ( updates === null ) {
				updateTimelineSlice( ( tl ) => {
					const next = { ...tl };
					delete next[ pathId ];
					return next;
				} );
			}
		},
		[ updateLayersSlice, updateTimelineSlice ]
	);

	const handleSetViewBox = useCallback(
		( vb ) => {
			setViewBox( ( prev ) => ( {
				...prev,
				[ role ]: { ...prev[ role ], [ breakpoint ]: vb },
			} ) );
		},
		[ role, breakpoint ]
	);

	const handleAddLayer = useCallback( () => {
		pushUndo();
		const name = `Layer ${ layers[ role ][ breakpoint ].length + 1 }`;
		const newLayer = createLayer( name );
		updateLayersSlice( ( ls ) => [ ...ls, newLayer ] );
		setActiveLayerForCurrent( newLayer.id );
	}, [
		role,
		breakpoint,
		layers,
		pushUndo,
		updateLayersSlice,
		setActiveLayerForCurrent,
	] );

	const handleDeleteLayer = useCallback(
		( layerId ) => {
			const bpLayers = layers[ role ][ breakpoint ];
			if ( bpLayers.length <= 1 ) {
				return;
			}
			pushUndo();
			const layer = bpLayers.find( ( l ) => l.id === layerId );
			if ( layer ) {
				updateTimelineSlice( ( tl ) => {
					const next = { ...tl };
					for ( const p of layer.paths ) {
						delete next[ p.id ];
					}
					return next;
				} );
			}
			const remaining = bpLayers.filter( ( l ) => l.id !== layerId );
			updateLayersSlice( () => remaining );
			if ( currentActiveLayerId === layerId ) {
				setActiveLayerForCurrent( remaining[ 0 ].id );
			}
			setSelectedPathId( null );
		},
		[
			role,
			breakpoint,
			layers,
			currentActiveLayerId,
			pushUndo,
			updateTimelineSlice,
			updateLayersSlice,
			setActiveLayerForCurrent,
		]
	);

	const handleDuplicateLayer = useCallback(
		( layerId ) => {
			pushUndo();
			const source = layers[ role ][ breakpoint ].find(
				( l ) => l.id === layerId
			);
			if ( ! source ) {
				return;
			}
			const newLayer = createLayer( source.name + ' copy' );
			let maxPathNum = 0;
			for ( const r of ROLES ) {
				for ( const bp of BREAKPOINTS ) {
					for ( const layer of layers[ r ][ bp ] ) {
						for ( const p of layer.paths ) {
							const m = p.id.match( /annotation-path-(\d+)/ );
							if ( m ) {
								maxPathNum = Math.max(
									maxPathNum,
									parseInt( m[ 1 ], 10 )
								);
							}
						}
					}
				}
			}
			newLayer.paths = source.paths.map( ( p ) => {
				maxPathNum++;
				return {
					...p,
					id: `annotation-path-${ String( maxPathNum ).padStart( 3, '0' ) }`,
				};
			} );

			const idx = layers[ role ][ breakpoint ].findIndex(
				( l ) => l.id === layerId
			);
			updateLayersSlice( ( ls ) => {
				const arr = [ ...ls ];
				arr.splice( idx + 1, 0, newLayer );
				return arr;
			} );
			setActiveLayerForCurrent( newLayer.id );
		},
		[
			role,
			breakpoint,
			layers,
			pushUndo,
			updateLayersSlice,
			setActiveLayerForCurrent,
		]
	);

	const handleMoveLayer = useCallback(
		( layerId, direction ) => {
			pushUndo();
			updateLayersSlice( ( ls ) => {
				const arr = [ ...ls ];
				const idx = arr.findIndex(
					( layer ) => layer.id === layerId
				);
				const newIdx = idx + direction;
				if ( newIdx < 0 || newIdx >= arr.length ) {
					return ls;
				}
				[ arr[ idx ], arr[ newIdx ] ] = [ arr[ newIdx ], arr[ idx ] ];
				return arr;
			} );
		},
		[ pushUndo, updateLayersSlice ]
	);

	const handleRenameLayer = useCallback(
		( layerId, newName ) => {
			updateLayersSlice( ( ls ) =>
				ls.map( ( layer ) =>
					layer.id === layerId
						? { ...layer, name: newName }
						: layer
				)
			);
		},
		[ updateLayersSlice ]
	);

	const handleResetAll = useCallback( async () => {
		if (
			! window.confirm(
				`Reset all ${ role } annotations (desktop and mobile)?`
			)
		) {
			return;
		}
		pushUndo();
		const dLayer = createLayer( 'Layer 1' );
		const mLayer = createLayer( 'Layer 1' );

		const nextLayers = {
			...layers,
			[ role ]: { desktop: [ dLayer ], mobile: [ mLayer ] },
		};
		const nextTimeline = {
			...timeline,
			[ role ]: { desktop: {}, mobile: {} },
		};

		setLayers( nextLayers );
		setActiveLayerId( ( a ) => ( {
			...a,
			[ role ]: { desktop: dLayer.id, mobile: mLayer.id },
		} ) );
		setTimeline( nextTimeline );
		setSelectedPathId( null );

		setIsSaving( true );
		setSaveStatus( null );
		try {
			const res = await fetch( `${ restUrl }annotations/${ postId }`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': nonce,
				},
				body: JSON.stringify( {
					svg: buildSvgPayload( nextLayers, viewBox ),
					timeline: nextTimeline,
				} ),
			} );
			if ( res.ok ) {
				setSaveStatus( 'saved' );
				setTimeout( () => setSaveStatus( null ), 2000 );
			} else {
				setSaveStatus( 'error' );
			}
		} catch {
			setSaveStatus( 'error' );
		}
		setIsSaving( false );
	}, [ role, layers, timeline, viewBox, pushUndo, restUrl, postId, nonce ] );

	const handleDeleteSelected = useCallback( () => {
		if ( ! selectedPathId ) {
			return;
		}
		pushUndo();
		handleUpdatePath( selectedPathId, null );
		setSelectedPathId( null );
	}, [ selectedPathId, pushUndo, handleUpdatePath ] );

	const handleSave = useCallback( async () => {
		setIsSaving( true );
		setSaveStatus( null );

		try {
			const res = await fetch( `${ restUrl }annotations/${ postId }`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': nonce,
				},
				body: JSON.stringify( {
					svg: buildSvgPayload( layers, viewBox ),
					timeline,
				} ),
			} );

			if ( res.ok ) {
				setSaveStatus( 'saved' );
				setTimeout( () => setSaveStatus( null ), 2000 );
			} else {
				setSaveStatus( 'error' );
			}
		} catch {
			setSaveStatus( 'error' );
		}

		setIsSaving( false );
	}, [ layers, viewBox, timeline, postId, restUrl, nonce ] );

	useEffect( () => {
		setSelectedPathId( null );
	}, [ mode, breakpoint, role ] );

	useEffect( () => {
		undoStackRef.current = [];
		setUndoCount( 0 );
	}, [ role ] );

	const ready = frameReady && ! isLoading;
	const currentSlot = slots[ role ];

	return (
		<>
			<div
				className={ `pa-stage${
					breakpoint === 'mobile' ? ' pa-stage--mobile' : ''
				}` }
			>
				<iframe
					ref={ frameRef }
					className="pa-stage__frame"
					src={ previewUrl }
					title="page preview"
					onLoad={ handleFrameLoad }
				/>

				{ ready && currentSlot && (
					<Canvas
						mode={ mode }
						breakpoint={ breakpoint }
						allPaths={ allCurrentPaths }
						activeLayerId={ currentActiveLayerId }
						layers={ layers[ role ] }
						timeline={ timeline[ role ] }
						strokeColor={ strokeColor }
						strokeWidth={ strokeWidth }
						selectedPathId={ selectedPathId }
						viewBox={ viewBox[ role ][ breakpoint ] }
						slotElement={ currentSlot }
						frameElement={ frameRef.current }
						mobileWidth={ mobileWidth }
						onAddPath={ handleAddPath }
						onAddTimeline={ handleAddTimeline }
						onSelectPath={ setSelectedPathId }
						onUpdatePath={ handleUpdatePath }
						onSetViewBox={ handleSetViewBox }
						onPushUndo={ pushUndo }
					/>
				) }
			</div>

			{ ready && (
			<Toolbar
				mode={ mode }
				onSetMode={ setMode }
				strokeColor={ strokeColor }
				onSetStrokeColor={ setStrokeColor }
				strokeWidth={ strokeWidth }
				onSetStrokeWidth={ setStrokeWidth }
				role={ role }
				availableRoles={ availableRoles }
				onToggleRole={ handleToggleRole }
				breakpoint={ breakpoint }
				onToggleBreakpoint={ handleToggleBreakpoint }
				layers={ layers[ role ][ breakpoint ] || [] }
				activeLayerId={ currentActiveLayerId }
				onSetActiveLayer={ setActiveLayerForCurrent }
				onAddLayer={ handleAddLayer }
				onDeleteLayer={ handleDeleteLayer }
				onDuplicateLayer={ handleDuplicateLayer }
				onMoveLayer={ handleMoveLayer }
				onRenameLayer={ handleRenameLayer }
				canUndo={ undoCount > 0 }
				onUndo={ handleUndo }
				onResetAll={ handleResetAll }
				onSave={ handleSave }
				onClose={ onClose }
				isSaving={ isSaving }
				selectedPathId={ selectedPathId }
				onDeleteSelected={ handleDeleteSelected }
			/>
			) }

			{ saveStatus === 'saved' && (
				<div className="pa-toast">Saved</div>
			) }
			{ saveStatus === 'error' && (
				<div className="pa-toast pa-toast-error">Error saving</div>
			) }
		</>
	);
}
