/**
 * Created by kalwe_000 on 8/2/2014.
 */


function PathHelper(){}
PathHelper.prototype.getValue = function(obj, path) {
    var parts = path.split('.');

    var result = obj;
    //console.log('  getting target from parts: ' + JSON.stringify(parts));
    var currPart;
    for (var i = 0; i < parts.length; i++) {
        currPart = parts[i];
        if (!result.hasOwnProperty(currPart)) // build path if doesn't exist
            result[currPart] = {};
        result = result[currPart];
    }

    return result;
};
PathHelper.prototype.getTarget = function(obj, path) {
    var parts = path.split('.');

    var result = obj;
    //console.log('  getting target from parts: ' + JSON.stringify(parts));
    var currPart;
    for (var i = 0; i < parts.length-1; i++) {
        currPart = parts[i];
        if (!result.hasOwnProperty(currPart)) // build path if doesn't exist
            result[currPart] = {};
        result = result[currPart];
    }

    return result;
};
PathHelper.prototype.setValue = function(obj, path, value) {
    var parts = path.split('.');
    var target = PathHelper.prototype.getTarget(obj, path);
    if(target) {
        target[parts[parts.length - 1]] = value;
    } else {
        console.log('ERROR: target does not exist: ', path);
    }
};
PathHelper.prototype.deleteValue = function(obj, path) {
    var parts = path.split('.');
    var target = PathHelper.prototype.getTarget(obj, parts);
    if(target) {
        delete target[parts[parts.length - 1]];
    }
};



function SyncDbPath(dbPath, dbTargetProperty, modelObj, modelPath, modelTargetProperty, enumerate, twoway) {
    // objects are passed by reference so we can observe db and modify model
    this.dbPath = dbPath;
    this.dbTargetProperty = dbTargetProperty;
    this.modelObj = modelObj;
    this.modelPath = modelPath;
    this.modelTargetProperty = modelTargetProperty;
    this.enumerate = enumerate | false;
    this.twoway = twoway | false;

    this.modelTarget = PathHelper.prototype.getValue(this.modelObj, this.modelPath);
    console.log('   observing modelPath: ', this.modelPath, this.modelTargetProperty);
    this.modelObserverInstance = this.modelObserver.bind(this)

    if(this.twoway)
        Object.observe(this.modelTarget, this.modelObserverInstance);

    if(syncDb.db) {
        this.dbObj = syncDb.db;
        this.observeDbObject();
    }

    this.dbChangedListenerInstance = this.dbChangedListener.bind(this);
    document.addEventListener('dbchanged', this.dbChangedListenerInstance);

    this.cancelNextUpdate = false;
};
SyncDbPath.prototype.observeDbObject = function () {
    if(this.dbTarget)
        Object.unobserve(this.dbTarget, this.dbObserverInstance);
    if(this.dbTarget && this.enumerate)
        Object.unobserve(this.dbTarget[this.dbTargetProperty], this.enumerateObserverInstance);

    this.dbTarget = PathHelper.prototype.getValue(this.dbObj, this.dbPath);
    this.setModelValue(this.modelTargetProperty, this.getDbValue());
    console.log('   observing dbPath: ', this.dbPath, this.dbTargetProperty, ': ', this.dbTarget);

    if(this.enumerate){
        if(!this.dbTarget[this.dbTargetProperty])
            this.dbTarget[this.dbTargetProperty] = {};
        this.enumerateObserverInstance = this.enumerateObserver.bind(this);
        console.log('enumerate observe dbTarget: ', this.dbTarget);
        console.log('enumerate observe dbTargetProperty: ', this.dbTarget[this.dbTargetProperty]);
        Object.observe(this.dbTarget[this.dbTargetProperty], this.enumerateObserverInstance);
    } else {
        this.dbObserverInstance = this.dbObserver.bind(this);
        Object.observe(this.dbTarget, this.dbObserverInstance);
    }
}
SyncDbPath.prototype.addItem = function (item, callback) {
    syncDb.addItem(this.dbPath, item, callback);
};
SyncDbPath.prototype.deleteItem = function (item, callback) {
    syncDb.delete(this.dbPath + '.' + item.id, callback);
};
SyncDbPath.prototype.getDbValue = function () {
    return this.dbTarget[this.dbTargetProperty];
};
SyncDbPath.prototype.setModelValue = function (property, value) {
    this.cancelNextUpdate = true;
    if(this.enumerate) {
        this.enumerated = this.enumerateObj(value);
        this.modelTarget[property] = this.enumerated;
    } else {
        this.modelTarget[property] = value;
    }
    //TODO: Should we call Object.deliverChangeRecords to enforce and reset cancelNextUpdate synchronously?
    //Object.deliverChangeRecords();
};
SyncDbPath.prototype.modelObserver = function (changes) {
    changes.forEach(function(change) {
        //console.log('   model changed: ', change.type, change.name, change.oldValue, change.object[change.name]);
        if(this.twoway && (change.name === '' || change.name === this.modelTargetProperty) && typeof change.oldValue !== 'undefined') {
//TODO: Try cancelNextUpdate with Object.deliverChangeRecords (in setModelValue)
//            if(this.cancelNextUpdate){
//                this.cancelNextUpdate = false;
//                console.log('       model update canceled: ', change.type, change.name, change.oldValue, change.object[change.name]);
//            } else {
                console.log('        sending model update: ', change.type, change.name, change.oldValue, change.object[change.name]);
                syncDb.update(this.dbPath + '.' + change.name, change.object[change.name]); // should be same as this.modelTarget[this.modelTargetProperty]
            //}

        }
    }.bind(this));
};
SyncDbPath.prototype.dbObserver = function (changes) {
    changes.forEach(function(change) {
        //console.log('   db changed1: ', change.type, change.name, change.oldValue, change.object[change.name], this.dbTargetProperty);
        if(this.dbTargetProperty === '' || change.name === this.dbTargetProperty) { // && typeof change.oldValue !== 'undefined')
            this.setModelValue(change.name, change.object[change.name]);
        }
    }.bind(this));
};
SyncDbPath.prototype.dbChangedListener = function (e) {
    this.dbObj = e.detail;
    this.observeDbObject();
};
SyncDbPath.prototype.enumerateObserver = function (changes) {
    changes.forEach(function(change) {
        if(change.type === 'add'){
            var value = change.object[change.name];
            this.enumerated.push(value);
            console.log('      enumerated added: ', change.type, change.name, change.oldValue, value);
        } else if (change.type === 'delete') {
            for (var n = this.enumerated.length-1; n >= 0; n--) {
                if (this.enumerated[n].id === change.oldValue.id) {
                    this.enumerated.splice(n, 1);
                    console.log('     deleted item from enumerated at: ' + n);
                }
            }
        } else
            console.log('ERROR: enumerated unhandled: ', change.type, change.name, change.oldValue, change.object[change.name], this.dbTargetProperty);
    }.bind(this));
};
SyncDbPath.prototype.enumerateObj = function (obj) {
    var result = [];
    if(obj) {
        Object.keys(obj).forEach(function (key) {
            if(key !== 'currId')
                result.push(obj[key]);
        });
    }
    //console.log('enumerated: ', JSON.stringify(result));
    return result;
};
SyncDbPath.prototype.unobserve = function () {
    if(this.dbTarget)
        Object.unobserve(this.dbTarget, this.dbObserverInstance);
    if(this.dbTarget && this.enumerate)
        Object.unobserve(this.dbTarget[this.dbTargetProperty], this.enumerateObserverInstance);
    if(this.twoway && this.modelTarget)
        Object.unobserve(this.modelTarget, this.modelObserverInstance);

    document.removeEventListener('dbchanged', this.dbChangedListenerInstance);
}




function SyncDbList(dbPath, modelObj, modelPath) {
    // objects are passed by reference so we can observe db and modify model
    this.dbPath = dbPath;
    this.modelObj = modelObj;
    this.modelPath = modelPath;

    if(syncDb.db) {
        this.dbObj = syncDb.db;
        this.observeDbObject();
    }

    this.dbChangedListenerInstance = this.dbChangedListener.bind(this);
    document.addEventListener('dbchanged', this.dbChangedListenerInstance);
};
SyncDbList.prototype.observeDbObject = function () {
    if(this.dbTarget)
        Object.unobserve(this.dbTarget, this.dbObserverInstance);

    this.dbTarget = PathHelper.prototype.getValue(this.dbObj, this.dbPath);
    this.setModelValue(this.dbTarget);

    this.enumerateObserverInstance = this.enumerateObserver.bind(this);
    Object.observe(this.dbTarget, this.enumerateObserverInstance);
}
SyncDbList.prototype.addItem = function (item, callback) {
    syncDb.addItem(this.dbPath, item, callback);
};
SyncDbList.prototype.deleteItem = function (item, callback) {
    syncDb.delete(this.dbPath + '.' + item.id, callback);
};
SyncDbList.prototype.setModelValue = function (value) {
    this.enumerated = this.enumerateObj(value);
    PathHelper.prototype.setValue(this.modelObj, this.modelPath, this.enumerated);
};
SyncDbList.prototype.dbChangedListener = function (e) {
    this.dbObj = e.detail;
    this.observeDbObject();
};
SyncDbList.prototype.enumerateObserver = function (changes) {
    changes.forEach(function(change) {
        if(change.type === 'add'){
            var value = change.object[change.name];
            this.enumerated.push(value);
            console.log('      enumerated added: ', change.type, change.name, change.oldValue, value);
        } else if (change.type === 'delete') {
            for (var n = this.enumerated.length-1; n >= 0; n--) {
                if (this.enumerated[n].id === change.oldValue.id) {
                    this.enumerated.splice(n, 1);
                    console.log('     deleted item from enumerated at: ' + n);
                }
            }
        } else
            console.log('ERROR: enumerated unhandled: ', change.type, change.name, change.oldValue, change.object[change.name], this.dbTargetProperty);
    }.bind(this));
};
SyncDbList.prototype.enumerateObj = function (obj) {
    var result = [];
    if(obj) {
        Object.keys(obj).forEach(function (key) {
            if(key !== 'currId')
                result.push(obj[key]);
        });
    }
    //console.log('enumerated: ', JSON.stringify(result));
    return result;
};
SyncDbList.prototype.unobserve = function () {
    if(this.dbTarget)
        Object.unobserve(this.dbTarget, this.dbObserverInstance);

    document.removeEventListener('dbchanged', this.dbChangedListenerInstance);
}








function SyncDb() {
    this.syncId = this.makeGuid();
    this.socket = io();
    this.callbacks = {};

    this.socket.on('init', function (id, db) {
        //console.log('   init rcvd: ' + JSON.stringify(db));
        this.db = db;
        this.initialized = true;
        this.fireDbChanged();
    }.bind(this));

    this.socket.on('update', function (id, path, value, requestId) {
        console.log('   update rcvd: ', path, JSON.stringify(value));
        PathHelper.prototype.setValue(this.db, path, value);
        this.doCallback(requestId);
    }.bind(this));

    this.socket.on('delete', function (id, path, value, requestId) {
        console.log('   delete rcvd: ', path, JSON.stringify(value));
        PathHelper.prototype.deleteValue(this.db, path);
        this.doCallback(requestId);
    }.bind(this));



    this.doCommand('init');
}
SyncDb.prototype.update = function (path, value, callback) {
    this.doCommand('update', path, value, callback);
};
SyncDb.prototype.delete = function (path, callback) {
    //this.update(path, null, callback);
    console.log('emitting delete path');
    this.doCommand('delete', path, null, callback);
};
SyncDb.prototype.addItem = function (path, item, callback) {
    this.doCommand('additem', path, item, callback);
};
//SyncDb.prototype.deleteItem = function (path, item, callback) {
//    this.doItemCommand('deleteitem', path, item, callback);
//};
SyncDb.prototype.doCommand = function (command, path, item, callback) {
    var requestId = this.makeGuid();
    if(callback){
        this.callbacks[requestId] = callback;
    }
    this.socket.emit(command, this.syncId, path, item, requestId);
    console.log('emitting command: ' + command);
};
SyncDb.prototype.doCallback = function (requestId) {
    if(requestId && this.callbacks[requestId]){
        this.callbacks[requestId]();
        delete this.callbacks[requestId];
    }
};
SyncDb.prototype.makeGuid = function () {
    function S4() {
        return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    }
    return (S4() + S4() + "-" + S4() + "-4" + S4().substr(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();
};
SyncDb.prototype.fireDbChanged = function () {
    //console.log(' detail: ' + JSON.stringify(this.db));
    var event = new CustomEvent('dbchanged', { 'detail': this.db });
    document.dispatchEvent(event);
}



