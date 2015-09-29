// -------------------------------------------------------------------------- \\
// File: ToolbarView.js                                                       \\
// Module: CollectionViews                                                    \\
// Requires: Core, Foundation, View, ControlViews                             \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

var toView = function ( name ) {
    return ( name === '-' ) ?
        NS.Element.create( 'span.v-Toolbar-divider' ) :
        this._views[ name ];
};

var OverflowMenuView = NS.Class({

    Extends: NS.MenuButtonView,

    didEnterDocument: function () {
        OverflowMenuView.parent.didEnterDocument.call( this );
        this.setShortcuts( null, '', {}, this.get( 'shortcuts' ) );
        return this;
    },

    willLeaveDocument: function () {
        this.setShortcuts( null, '', this.get( 'shortcuts' ), {} );
        return OverflowMenuView.parent.willLeaveDocument.call( this );
    },

    shortcuts: function () {
        var views = this.getFromPath( 'menuView.options' );
        return views ? views.reduce( function ( acc, view ) {
            var shortcut = view.get( 'shortcut' );
            if ( shortcut ) {
                shortcut.split( ' ' ).forEach( function ( key ) {
                    acc[ key ] = view;
                });
            }
            return acc;
        }, {} ) : {};
    }.oProperty( 'menuView' ),

    setShortcuts: function ( _, __, oldShortcuts, shortcuts ) {
        if ( this.get( 'isInDocument' ) ) {
            var kbShortcuts = NS.ViewEventsController.kbShortcuts,
                key;
            if ( !shortcuts ) { shortcuts = this.get( 'shortcuts' ); }
            for ( key in oldShortcuts ) {
                kbShortcuts.deregister( key, this, 'activateButton' );
            }
            for ( key in shortcuts ) {
                kbShortcuts.register( key, this, 'activateButton' );
            }
        }
    }.observes( 'shortcuts' ),

    activateButton: function ( event ) {
        var key = NS.DOMEvent.lookupKey( event ),
            button = this.get( 'shortcuts' )[ key ];
        if ( button instanceof NS.MenuButtonView ) {
            this.activate();
        }
        button.activate();
    }
});

var ToolbarView = NS.Class({

    Extends: NS.View,

    className: 'v-Toolbar',

    config: 'standard',
    minimumGap: 20,
    preventOverlap: false,

    init: function ( mixin ) {
        ToolbarView.parent.init.call( this, mixin );
        this._views = {
            overflow: new OverflowMenuView({
                label: NS.loc( 'More' ),
                popOverView: mixin.popOverView || new NS.PopOverView()
            })
        };
        this._configs = {
            standard: {
                left: [],
                right: []
            }
        };
        this._measureView = null;
        this._widths = {};
    },

    registerView: function ( name, view, _dontMeasure ) {
        this._views[ name ] = view;
        if ( !_dontMeasure && this.get( 'isInDocument' ) &&
                this.get( 'preventOverlap' ) ) {
            this.preMeasure().postMeasure();
        }
        return this;
    },

    registerViews: function ( views ) {
        for ( var name in views ) {
            this.registerView( name, views[ name ], true );
        }
        if ( this.get( 'isInDocument' ) && this.get( 'preventOverlap' ) ) {
            this.preMeasure().postMeasure();
        }
        return this;
    },

    registerConfig: function ( name, config ) {
        this._configs[ name ] = config;
        if ( this.get( 'config' ) === name ) {
            this.computedPropertyDidChange( 'config' );
        }
        return this;
    },

    registerConfigs: function ( configs ) {
        for ( var name in configs ) {
            this.registerConfig( name, configs[ name ] );
        }
        return this;
    },

    getView: function ( name ) {
        return this._views[ name ];
    },

    // ---

    leftConfig: function () {
        var configs = this._configs,
            config = configs[ this.get( 'config' ) ];
        return ( config && config.left ) || configs.standard.left;
    }.oProperty( 'config' ),

    rightConfig: function () {
        var configs = this._configs,
            config = configs[ this.get( 'config' ) ];
        return ( config && config.right ) || configs.standard.right;
    }.oProperty( 'config' ),

    left: function () {
        var leftConfig = this.get( 'leftConfig' ),
            rightConfig = this.get( 'rightConfig' ),
            pxWidth = this.get( 'pxWidth' ),
            widths = this._widths,
            i, l;

        if ( widths && pxWidth && this.get( 'preventOverlap' ) ) {
            pxWidth -= this.get( 'minimumGap' );
            for ( i = 0, l = rightConfig.length; i < l; i += 1 ) {
                pxWidth -= widths[ rightConfig[i] ];
            }
            for ( i = 0, l = leftConfig.length; i < l; i += 1 ) {
                pxWidth -= widths[ leftConfig[i] ];
            }
            if ( pxWidth < 0 ) {
                pxWidth -= widths[ '-' ];
                pxWidth -= widths.overflow;

                while ( pxWidth < 0 && l-- ) {
                    pxWidth += widths[ leftConfig[l] ];
                }
                if ( l < 0 ) { l = 0; }

                this._views.overflow.set( 'menuView', new NS.MenuView({
                    showFilter: false,
                    options: leftConfig.slice( l )
                        .map( toView, this )
                        .filter( function ( view ) {
                            return view instanceof NS.View;
                        })
                }) );

                if ( l > 0 ) {
                    if ( leftConfig[ l - 1 ] === '-' ) {
                        l -= 1;
                    }
                    leftConfig = leftConfig.slice( 0, l );
                    leftConfig.push( '-' );
                    leftConfig.push( 'overflow' );
                } else {
                    leftConfig = [ 'overflow' ];
                    l = 0;
                }
            }
        }
        return leftConfig.map( toView, this );
    }.oProperty( 'leftConfig', 'rightConfig', 'pxWidth' ),

    right: function () {
        return this.get( 'rightConfig' ).map( toView, this );
    }.oProperty( 'rightConfig' ),

    preMeasure: function () {
        this.insertView( this._measureView =
            new NS.View({
                className: 'v-Toolbar-section v-Toolbar-section--measure',
                layerStyles: {},
                childViews: Object.values( this._views )
                                  .filter( function ( view ) {
                    return !view.get( 'parentView' );
                }),
                draw: function ( layer, Element, el ) {
                    return [
                        el( 'span.v-Toolbar-divider' ),
                        NS.View.prototype.draw.call( this, layer, Element, el )
                    ];
                }
            }),
            this.get( 'layer' ).lastChild,
            'before'
        );
        return this;
    },

    postMeasure: function () {
        var widths = this._widths,
            views = this._views,
            measureView = this._measureView,
            unused = measureView.get( 'childViews' ),
            container = measureView.get( 'layer' ),
            containerBoundingClientRect = container.getBoundingClientRect(),
            firstButton = unused.length ? unused[0].get( 'layer' ) : null,
            name, l;

        for ( name in views ) {
            widths[ name ] = views[ name ].get( 'pxWidth' ) || widths[ name ];
        }

        // Want to include any left/right margin, so get difference between
        // edge of first button and start of container
        widths[ '-' ] = ( firstButton ?
            firstButton.getBoundingClientRect().left :
            containerBoundingClientRect.right
        ) - containerBoundingClientRect.left;

        this.removeView( measureView );
        l = unused.length;
        while ( l-- ) {
            measureView.removeView( unused[l] );
        }
        measureView.destroy();
        this._measureView = null;

        return this;
    },

    willEnterDocument: function () {
        if ( this.get( 'preventOverlap' ) ) {
            this.preMeasure();
        }
        return ToolbarView.parent.willEnterDocument.call( this );
    },

    didEnterDocument: function () {
        this.beginPropertyChanges();
        ToolbarView.parent.didEnterDocument.call( this );
        if ( this.get( 'preventOverlap' ) ) {
            this.postMeasure();
        }
        this.endPropertyChanges();
        return this;
    },

    draw: function ( layer, Element, el ) {
        return [
            el( 'div.v-Toolbar-section.v-Toolbar-section--left',
                this.get( 'left' )
            ),
            el( 'div.v-Toolbar-section.v-Toolbar-section--right',
                this.get( 'right' )
            )
        ];
    },

    toolbarNeedsRedraw: function ( self, property, oldValue ) {
       return this.propertyNeedsRedraw( self, property, oldValue );
    }.observes( 'left', 'right' ),

    redrawLeft: function ( layer, oldViews ) {
        this.redrawSide( layer.firstChild, oldViews, this.get( 'left' ) );
    },
    redrawRight: function ( layer, oldViews ) {
        this.redrawSide( layer.lastChild, oldViews, this.get( 'right' ) );
    },

    redrawSide: function ( container, oldViews, newViews ) {
        var View = NS.View,
            start = 0,
            isEqual = true,
            i, l, view, parent;

        for ( i = start, l = oldViews.length; i < l; i += 1 ) {
            view = oldViews[i];
            if ( view instanceof View ) {
                if ( isEqual && view === newViews[i] ) {
                    start += 1;
                } else {
                    isEqual = false;
                    // Check it hasn't already swapped sides!
                    if ( view.get( 'layer' ).parentNode === container ) {
                        this.removeView( view );
                    }
                }
            } else {
                if ( isEqual && !( newViews[i] instanceof View ) ) {
                    start += 1;
                    newViews[i] = view;
                } else {
                    container.removeChild( view );
                }
            }
        }
        for ( i = start, l = newViews.length; i < l; i += 1 ) {
            view = newViews[i];
            if ( view instanceof View ) {
                if ( parent = view.get( 'parentView' ) ) {
                    parent.removeView( view );
                }
                this.insertView( view, container );
            } else {
                container.appendChild( view );
            }
        }
    }
});

NS.ToolbarView = ToolbarView;

}( O ) );
