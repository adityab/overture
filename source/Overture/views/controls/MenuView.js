// -------------------------------------------------------------------------- \\
// File: MenuView.js                                                          \\
// Module: ControlViews                                                       \\
// Requires: Core, Foundation, DOM, View                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

// A menu option must have:
// filter( pattern ): RegExp -> Boolean
// isFocussed: Boolean
// isHidden: Boolean
// isDisabled: Boolean

var MenuController = NS.Class({

    Extends: NS.Object,

    options: [],

    // --- Focus ---

    canSelect: function ( option ) {
        return !option.get( 'isHidden' ) && !option.get( 'isDisabled' );
    },

    focussedOption: null,

    getAdjacentOption: function ( step ) {
        var options = this.get( 'options' ),
            l = options.get( 'length' ),
            i = options.indexOf( this.get( 'focussedOption' ) ),
            current;

        if ( i < 0 && step < 0 ) {
            i = l;
        }
        current = i.mod( l );

        do {
            i = ( i + step ).mod( l );
        } while ( l &&
            !this.canSelect( options.getObjectAt( i ) ) && i !== current );

        return options.getObjectAt( i );
    },

    focusPrevious: function ( event ) {
        if ( event ) { event.preventDefault(); }
        return this.focusOption( this.getAdjacentOption( -1 ) );
    },

    focusNext: function ( event ) {
        if ( event ) { event.preventDefault(); }
        return this.focusOption( this.getAdjacentOption( 1 ) );
    },

    focusOption: function ( option ) {
        var current = this.get( 'focussedOption' );
        if ( current !== option ) {
            if ( current ) {
                current.set( 'isFocussed', false );
            }
            if ( option ) {
                if ( !this.canSelect( option ) ) {
                    option = null;
                } else {
                    option.set( 'isFocussed', true );
                }
            }
            this.set( 'focussedOption', option );
        }
        return this;
    },

    blurOption: function ( option ) {
        if ( this.get( 'focussedOption' ) === option ) {
            this.focusOption( null );
        }
        return this;
    },

    selectFocussed: function ( event ) {
        if ( event ) { event.preventDefault(); }
        var focussedOption = this.get( 'focussedOption' );
        if ( focussedOption && this.canSelect( focussedOption ) ) {
            focussedOption.activate( this );
        }
        return this;
    },

    // --- Filter ---

    filter: '',

    filterDidChange: function () {
        var value = this.get( 'filter' ).escapeRegExp(),
            pattern = value ? NS.i18n.makeSearchRegExp( value ) : null,
            options = this.get( 'options' ),
            l = options.get( 'length' ),
            focussedOption = this.get( 'focussedOption' );

        while ( l-- ) {
            options.getObjectAt( l ).filter( pattern );
        }
        if ( !focussedOption || !this.canSelect( focussedOption ) ) {
            this.focusOption( null ).focusNext();
        }
    }.observes( 'filter' ),

    // --- Keyboard support ---

    keyBindings: {
        esc: 'onEscape',
        enter: 'selectFocussed',
        up: 'focusPrevious',
        down: 'focusNext',
        left: 'closeIfSub',
        right: 'activateIfMenu'
    },

    triggerKeyBinding: function ( event ) {
        var key = NS.DOMEvent.lookupKey( event ),
            bindings = this.get( 'keyBindings' );
        if ( bindings[ key ] ) {
            event.stopPropagation();
            this[ bindings[ key ] ]( event, key );
        }
    }.on( 'keydown' ),

    onEscape: function ( event ) {
        event.preventDefault();
        var filter = this.get( 'filter' );
        if ( filter ) {
            this.set( 'filter', '' );
        } else {
            this.get( 'view' ).hide();
        }
    },

    closeIfSub: function () {
        var view = this.get( 'view' ),
            popOverView;
        if ( !view.get( 'showFilter' ) &&
                ( popOverView = view.getParent( NS.PopOverView ) ) &&
                  popOverView.get( 'parentPopOverView' ) ) {
            view.hide();
        }
    },

    activateIfMenu: function () {
        var focussedOption = this.get( 'focussedOption' );
        if ( focussedOption &&
                focussedOption.get( 'button' ) instanceof NS.MenuButtonView ) {
            this.selectFocussed();
        }
    }
});

var MenuOptionView = NS.Class({

    Extends: NS.View,

    isHidden: false,
    isDisabled: function () {
        return this.getFromPath( 'button.isDisabled' );
    }.oProperty( 'button.isDisabled' ),
    isFocussed: false,
    isFocussable: function () {
        return !this.get( 'isHidden' ) && !this.get( 'isDisabled' );
    }.oProperty( 'isHidden', 'isDisabled' ),

    layerTag: 'li',

    className: function () {
        return 'v-MenuOption' +
            ( this.get( 'isFocussed' ) ? ' is-focussed' : '' ) +
            ( this.get( 'isHidden' ) ? ' u-hidden' : '' );
    }.oProperty( 'isFocussed', 'isHidden' ),

    init: function ( view, controller ) {
        this.childViews = [ view ];
        this.button = view;
        this.controller = controller;
        MenuOptionView.parent.init.call( this );
    },

    scrollIntoView: function () {
        if ( this.get( 'isFocussed' ) ) {
            var scrollView = this.getParent( NS.ScrollView );
            if ( scrollView ) {
                var scrollHeight = scrollView.get( 'pxHeight' ),
                    scrollTop = scrollView.get( 'scrollTop' ),
                    top = this.getPositionRelativeTo( scrollView ).top,
                    height = this.get( 'pxHeight' );

                if ( top < scrollTop ) {
                    scrollView.scrollTo( 0, top - ( height >> 1 ), true );
                } else if ( top + height > scrollTop + scrollHeight ) {
                    scrollView.scrollTo( 0,
                        top + height - scrollHeight + ( height >> 1 ), true );
                }
            }
            if ( !this.getParent( MenuView ).get( 'showFilter' ) ) {
                this.button.focus();
            }
        }
    }.observes( 'isFocussed' ),

    _focusTimeout: null,

    takeFocus: function () {
        if ( this.get( 'isInDocument' ) ) {
            this.get( 'controller' ).focusOption( this )
                .activateIfMenu();
        }
    },

    mouseMove: function () {
        if ( !this.get( 'isFocussed' ) && !this._focusTimeout ) {
            var popOverView = this.getParent( NS.PopOverView );
            if ( popOverView && popOverView.hasSubView() ) {
                this._focusTimeout = NS.RunLoop.invokeAfterDelay(
                    this.takeFocus, 75, this );
            } else {
                this.takeFocus();
            }
        }
    }.on( 'mousemove' ),

    mouseOut: function () {
        if ( this._focusTimeout ) {
            NS.RunLoop.cancel( this._focusTimeout );
            this._focusTimeout = null;
        }
        if ( !this.get( 'button' ).get( 'isActive' ) ) {
            this.get( 'controller' ).blurOption( this );
        }
    }.on( 'mouseout' ),

    filter: function ( pattern ) {
        var label = this.get( 'button' ).get( 'label' );
        this.set( 'isHidden', !!pattern && !pattern.test( label ) );
    },

    activate: function () {
        var button = this.get( 'button' );
        if ( button.activate ) { button.activate(); }
    }
});

var MenuView = NS.Class({

    Extends: NS.View,

    className: 'v-Menu',

    showFilter: false,
    closeOnActivate: true,

    didCreateLayer: function ( layer ) {
        MenuView.parent.didCreateLayer.call( this, layer );
        layer.addEventListener( 'mousemove', this, false );
        layer.addEventListener( 'mouseout', this, false );
    },

    willDestroyLayer: function ( layer ) {
        layer.removeEventListener( 'mouseout', this, false );
        layer.removeEventListener( 'mousemove', this, false );
        MenuView.parent.willDestroyLayer.call( this, layer );
    },

    didEnterDocument: function () {
        MenuView.parent.didEnterDocument.call( this );
        var scrollView = this._scrollView,
            windowHeight, delta, controller, input;
        if ( scrollView ) {
            windowHeight = ( this.getParent( NS.ScrollView ) ||
                this.getParent( NS.RootView ) ).get( 'pxHeight' );
            delta = this.get( 'layer' ).getBoundingClientRect().bottom -
                windowHeight;
            // Must redraw immediately so size is correct when PopOverView
            // checks if it is positioned off screen.
            scrollView.set( 'layout', {
                maxHeight: Math.max(
                    scrollView.get( 'pxHeight' ) - delta - 10,
                    windowHeight / 2
                )
            }).redraw();
        }

        if ( this.get( 'showFilter' ) ) {
            controller = this.get( 'controller' );
            input = this._input;
            if ( !controller.get( 'focussedOption' ) ) {
                controller.focusNext();
            }
            NS.RunLoop.invokeInNextFrame( function () {
                input.focus().set( 'selection', {
                    start: 0,
                    end: input.get( 'value' ).length
                });
            });
        }
        return this;
    },

    didLeaveDocument: function () {
        var controller = this.get( 'controller' );
        if ( this.get( 'showFilter' ) ) {
            controller.set( 'filter', '' );
        } else {
            controller.focusOption( null );
        }
        return MenuView.parent.didLeaveDocument.call( this );
    },

    mayHaveResized: function () {
        this.parentViewDidResize();
    }.queue( 'after' ).observes( 'controller.filter' ),

    nextEventTarget: function () {
        return this.get( 'controller' );
    }.oProperty( 'controller' ),

    controller: function () {
        return new MenuController({
            view: this
        });
    }.oProperty(),

    ItemView: MenuOptionView,

    draw: function ( layer, Element, el ) {
        var controller = this.get( 'controller' ),
            MenuOptionView = this.get( 'ItemView' ),
            optionViews = this.get( 'options' ).map( function ( view ) {
                return new MenuOptionView( view, controller );
            });
        controller.set( 'options', optionViews );
        return [
            this.get( 'showFilter' ) ? el( 'div.v-Menu-filter', [
                this._input = new NS.SearchTextView({
                    blurOnEscape: false,
                    value: NS.bindTwoWay( 'filter', this.get( 'controller' ) )
                })
            ]) : null,
            this._scrollView = new NS.ScrollView({
                positioning: 'relative',
                layout: {},
                layerTag: 'ul',
                childViews: optionViews
            })
        ];
    },

    hide: function () {
        var parent = this.get( 'parentView' );
        if ( parent ) {
            NS.RunLoop.invokeInNextFrame( parent.hide, parent );
        }
    },

    hideAll: function () {
        if ( this.get( 'closeOnActivate' ) ) {
            var popOverView = this.getParent( NS.PopOverView ) ||
                    this.get( 'parentView' ),
                parent;
            if ( popOverView ) {
                while ( parent = popOverView.get( 'parentPopOverView' ) ) {
                    popOverView = parent;
                }
                NS.RunLoop.invokeInNextFrame( popOverView.hide, popOverView );
            }
        }
    }.on( 'button:activate' ),

    fireShortcut: function ( event ) {
        if ( !this.get( 'showFilter' ) ) {
            var key = NS.DOMEvent.lookupKey( event ),
                handler = NS.ViewEventsController
                            .kbShortcuts.getHandlerForKey( key ),
                parent, object, method;
            if ( handler ) {
                parent = object = handler[0];
                method = handler[1];
                // Check object is child view of the menu; we want to ignore any
                // other keyboard shortcuts.
                if ( object instanceof NS.View ) {
                    while ( parent && parent !== this ) {
                        parent = parent.get( 'parentView' );
                    }
                    if ( parent ) {
                        object[ method ]( event );
                        event.preventDefault();
                    }
                }
            }
        }
    }.on( 'keypress' )
});

NS.MenuController = MenuController;
NS.MenuOptionView = MenuOptionView;
NS.MenuView = MenuView;

}( O ) );
