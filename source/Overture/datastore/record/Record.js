// -------------------------------------------------------------------------- \\
// File: Record.js                                                            \\
// Module: DataStore                                                          \\
// Requires: Core, Foundation, Status.js                                      \\
// Author: Neil Jenkins                                                       \\
// License: © 2010-2015 FastMail Pty Ltd. MIT Licensed.                       \\
// -------------------------------------------------------------------------- \\

"use strict";

( function ( NS ) {

/**
    Class: O.Record-AttributeErrors

    Extends: O.Object

    Maintains the state of the validity of each attribute on a record.
*/
var AttributeErrors = NS.Class({

    Extends: NS.Object,

    /**
        Property: O.Record-AttributeErrors#errorCount
        Type: Number

        The number of attributes on the record in an error state.
    */

    /**
        Constructor: O.Record-AttributeErrors

        Parameters:
            record - {O.Record} The record to manage attribute errors for.
    */
    init: function ( record ) {
        AttributeErrors.parent.init.call( this );

        var attrs = NS.meta( record ).attrs,
            metadata = NS.meta( this ),
            dependents = metadata.dependents = NS.clone( metadata.dependents ),
            errorCount = 0,
            attrKey, propKey, attribute, error, dependencies, l, key;

        for ( attrKey in attrs ) {
            // Check if attribute has been removed (e.g. in a subclass).
            if ( propKey = attrs[ attrKey ] ) {
                // Validate current value and set error on this object.
                attribute = record[ propKey ];
                error = this[ propKey ] = attribute.validate ?
                  attribute.validate( record.get( propKey ), propKey, record ) :
                  null;

                // Keep an error count
                if ( error ) { errorCount += 1; }

                // Add observers for validity dependencies.
                dependencies = attribute.validityDependencies;
                if ( dependencies ) {
                    l = dependencies.length;
                    while ( l-- ) {
                        key = dependencies[l];
                        if ( !dependents[ key ] ) {
                            dependents[ key ] = [];
                            record.addObserverForKey(
                                key, this, 'attrDidChange' );
                        }
                        dependents[ key ].push( propKey );
                    }
                }
            }
        }

        this.errorCount = errorCount;
        this._record = record;
    },

    /**
        Method: O.Record-AttributeErrors#attrDidChange

        Called when an attribute changes on the record for which another
        attribute has a validity dependency.

        Parameters:
            _    - {*} Unused.
            attr - {String} The name of the attribute which has changed.
    */
    attrDidChange: function ( _, attr ) {
        var metadata = NS.meta( this ),
            changed = metadata.changed = {},
            dependents = metadata.dependents[ attr ],
            l = dependents.length,
            record = this._record,
            propKey, attribute;

        this.beginPropertyChanges();
        while ( l-- ) {
            propKey = dependents[l];
            attribute = record[ propKey ];
            changed[ propKey ] = {
                oldValue: this[ propKey ],
                newValue: this[ propKey ] = ( attribute.validate ?
                  attribute.validate( record.get( propKey ), propKey, record ) :
                  null )
            };
        }
        this.endPropertyChanges();
    },

    /**
        Method: O.Record-AttributeErrors#setRecordValidity

        Updates the internal count of how many attributes are invalid and sets
        the <O.Record#isValid> property. Called automatically whenever a
        validity error string changes.

        Parameters:
            _       - {*} Unused.
            changed - {Object} A map of validity string changes.
    */
    setRecordValidity: function ( _, changed ) {
        var errorCount = this.get( 'errorCount' ),
            key, vals, wasValid, isValid;
        for ( key in changed ) {
            if ( key !== 'errorCount' ) {
                vals = changed[ key ];
                wasValid = !vals.oldValue;
                isValid = !vals.newValue;
                if ( wasValid && !isValid ) {
                    errorCount += 1;
                }
                else if ( isValid && !wasValid ) {
                    errorCount -= 1;
                }
            }
        }
        this.set( 'errorCount', errorCount )
            ._record.set( 'isValid', !errorCount );
    }.observes( '*' )
});

var Status = NS.Status;
var READY_NEW_DIRTY = (Status.READY|Status.NEW|Status.DIRTY);

/**
    Class: O.Record

    Extends: O.Object

    All data object classes managed by the store must inherit from Record. This
    provides the basic status management for the attributes.
*/
var Record = NS.Class({

    Extends: NS.Object,

    /**
        Constructor: O.Record

        Parameters:
            store    - {Store} The store to link to this record.
            storeKey - {String} (optional) The unique id for this record in the
                       store. If ommitted, a new record will be created, which
                       can then be committed to the store using the
                       <O.Record#saveToStore> method.
    */
    init: function ( store, storeKey ) {
        this._noSync = false;
        this._data = storeKey ? null : {};
        this.store = store;
        this.storeKey = storeKey;

        Record.parent.init.call( this );
    },

    /**
        Property: O.Record#store
        Type: O.Store

        The store this record is associated with.
    */

    /**
        Property: O.Record#storeKey
        Type: (String|undefined)

        The record store key; will be unique amonsgst all loaded records, even
        across those of different types.
    */

    /**
        Property: O.Record#status
        Type: O.Status

        The status of this Record. A Record goes through three primary phases:
        EMPTY -> READY -> DESTROYED. Alternatively it may go EMPTY ->
        NON_EXISTENT. Whilst in these phases it may acquire other properties:
        LOADING, NEW, DIRTY, OBSOLETE. Each of the primary phases as well as the
        secondary properties are different bits in the status bitarray. You
        should check the condition by using bitwise operators with the constants
        defined in <O.Status>.
    */
    status: function () {
        var storeKey = this.get( 'storeKey' );
        return storeKey ?
            this.get( 'store' ).getStatus( storeKey ) :
            READY_NEW_DIRTY;
    }.oProperty().nocache(),

    /**
        Method: O.Record#is

        Checks whether record has a particular status. You can also supply a
        union of statuses (e.g. `record.is(O.Status.OBSOLETE|O.Status.DIRTY)`),
        in which case it will return true if the record has *any* of these
        status bits set.

        Parameters:
            state - {O.Status} The status to check.

        Returns:
            {Boolean} True if the record has the queried status.
    */
    is: function ( state ) {
        return !!( this.get( 'status' ) & state );
    },

    /**
        Method: O.Record#setObsolete

        Adds <O.Status.OBSOLETE> to the current status value.

        Returns:
            {O.Record} Returns self.
    */
    setObsolete: function () {
        var storeKey = this.get( 'storeKey' ),
            status = this.get( 'status' );
        if ( storeKey ) {
            this.get( 'store' ).setStatus( storeKey, status | Status.OBSOLETE );
        }
        return this;
    },

    /**
        Method: O.Record#setLoading

        Adds <O.Status.LOADING> to the current status value.

        Returns:
            {O.Record} Returns self.
    */
    setLoading: function () {
        var storeKey = this.get( 'storeKey' ),
            status = this.get( 'status' );
        if ( storeKey ) {
            this.get( 'store' ).setStatus( storeKey, status | Status.LOADING );
        }
        return this;
    },

    /**
        Property: O.Record#id
        Type: String

        The record id. It's fine to override this with an attribute, provided it
        is the primary key. If the primary key for the record is not called
        'id', you must not override this property.
    */
    id: function () {
        var storeKey = this.get( 'storeKey' );
        return storeKey ?
            this.get( 'store' ).getIdFromStoreKey( storeKey ) :
            this.get( this.constructor.primaryKey );
    }.oProperty(),

    toJSON: function () {
        return this.get( 'storeKey' );
    },

    toIdOrStoreKey: function () {
        return this.get( 'id' ) || ( '#' + this.get( 'storeKey' ) );
    },

    /**
        Method: O.Record#saveToStore

        Saves the record to the store. Will then be committed back by the store
        according to the store's policy. Note, only a record not currently
        created in its store can do this; an error will be thrown if this method
        is called for a record already created in the store.

        Returns:
            {O.Record} Returns self.
    */
    saveToStore: function () {
        if ( this.get( 'storeKey' ) ) {
            throw new Error( "Record already created in store." );
        }
        var Type = this.constructor,
            data = this._data,
            store = this.get( 'store' ),
            idPropKey = Type.primaryKey || 'id',
            idAttrKey = this[ idPropKey ].key || idPropKey,
            storeKey = store.getStoreKey( Type, data[ idAttrKey ] ),
            attrs = NS.meta( this ).attrs,
            attrKey, propKey, attribute, defaultValue;

        this._data = null;

        // Fill in any missing defaults
        for ( attrKey in attrs ) {
            propKey = attrs[ attrKey ];
            if ( propKey ) {
                attribute = this[ propKey ];
                if ( !( attrKey in data ) && !attribute.noSync ) {
                    defaultValue = attribute.defaultValue;
                    if ( defaultValue !== undefined ) {
                        data[ attrKey ] = defaultValue && defaultValue.toJSON ?
                            defaultValue.toJSON() : NS.clone( defaultValue );
                    }
                }
            }
        }

        // Save to store
        store.createRecord( storeKey, data )
             .setRecordForStoreKey( storeKey, this )
             .fire( 'record:user:create', { record: this } );

        // And save store reference on record instance.
        return this.set( 'storeKey', storeKey );
    },

    /**
        Method: O.Record#discardChanges

        Reverts the attributes in the record to the last committed state. If
        the record has never been committed, this will destroy the record.

        Returns:
            {O.Record} Returns self.
    */
    discardChanges: function () {
        if ( this.get( 'status' ) === READY_NEW_DIRTY ) {
            this.destroy();
        } else {
            var storeKey = this.get( 'storeKey' );
            if ( storeKey ) {
                this.get( 'store' ).revertData( storeKey );
            }
        }
        return this;
    },

    /**
        Method: O.Record#refresh

        Fetch/refetch the data from the source. Will have no effect if the
        record is new or already loading.

        Returns:
            {O.Record} Returns self.
    */
    refresh: function () {
        var storeKey = this.get( 'storeKey' );
        if ( storeKey ) { this.get( 'store' ).fetchData( storeKey ); }
        return this;
    },

    /**
        Method: O.Record#destroy

        Destroy the record. This will inform the store, which will commit it to
        the source.
    */
    destroy: function () {
        var storeKey = this.get( 'storeKey' );
        if ( storeKey && this.get( 'isEditable' ) ) {
            this.get( 'store' )
                .fire( 'record:user:destroy', { record: this } )
                .destroyRecord( storeKey );
        }
    },

    /**
        Method: O.Record#getDoppelganger

        Parameters:
            store - {O.Store} A store to get this event in.

        Returns:
            {O.Record} Returns the record instance for the same record in the
            given store.
    */
    getDoppelganger: function ( store ) {
        if ( this.get( 'store' ) === store ) {
            return this;
        }
        return store.materialiseRecord(
            this.get( 'storeKey' ), this.constructor );
    },

    /**
        Method: O.Record#storeWillUnload

        This should only be called by the store, when it unloads the record's
        data to free up memory.
    */
    storeWillUnload: function () {
        Record.parent.destroy.call( this );
    },

    /**
        Property (private): O.Record#_noSync
        Type: Boolean

        If true, any changes to the record will not be committed to the source.
    */

    /**
        Method: O.Record#stopSync

        Any changes after this has been invoked will not by synced to the
        source.

        Returns:
            {O.Record} Returns self.
    */
    stopSync: function () {
        this._noSync = true;
        return this;
    },

    /**
        Method: O.Record#startSync

        If syncing has been stopped by a call to <O.Record#stopSync>, this
        will then enable it again for any *future* changes.

        Returns:
            {O.Record} Returns self.
    */
    startSync: function () {
        this._noSync = false;
        return this;
    },

    /**
        Property: O.Record#isEditable
        Type: Boolean
        Default: True

        May the record be edited/deleted?
    */
    isEditable: true,

    /**
        Property: O.Record#isValid
        Type: Boolean

        Are all the attributes are in a valid state?
    */
    isValid: function ( value ) {
        return ( value !== undefined ) ? value :
            !this.get( 'errorForAttribute' ).get( 'errorCount' );
    }.oProperty(),

    /**
        Method: O.Record#errorToSet

        Checks whether it will be an error to set the attribute with the given
        key to the given value. If it will be an error, the string describing
        the error is returned, otherwise an empty string is returned.

        Parameters:
            key   - {String} The name of the attribute.
            value - {*} The proposed value to set it to.

        Returns:
            {O.ValidationError|null} The error, or null if the assignment would
            be valid.
    */
    errorToSet: function ( key, value ) {
        var attr = this[ key ];
        return attr.validate ? attr.validate( value, key, this ) : null;
    },

    /**
        Property: O.Record#errorForAttribute
        Type: O.Object

        Calling get() with the key for an attribute on this record will return
        an error string if the currently set value is invalid, or an empty
        string if the attribute is currently valid. You can bind to the
        properties on this object.
    */
    errorForAttribute: function () {
        return new AttributeErrors( this );
    }.oProperty()
});

/**
    Property: O.Record.primaryKey
    Type: String

    Set automatically by the O.RecordAttribute with `isPrimaryKey: true`. If
    no primary key is set, there is presumed to be a property called "id"
    that is the primary key.
*/

NS.Record = Record;

}( O ) );
