/**
 * Created by kalwe_000 on 8/2/2014.
 */


function PathHelper(){}
PathHelper.prototype.getTarget = function(target, parts) {
    if (!parts.length) {
        console.log('Error: parts.length should be >= 1')
        return null;
    }

    //console.log('  getting target from parts: ' + JSON.stringify(parts));
    var currPart;
    for (var i = 0; i < parts.length - 1; i++) {
        currPart = parts[i];
        if (!target.hasOwnProperty(currPart)) // build path if doesn't exist
            target[currPart] = {};
        target = target[currPart];
    }

    return target;
};
PathHelper.prototype.setValue = function(obj, path, value) {
    var parts = path.split('.');
    var target = PathHelper.prototype.getTarget(obj, parts);
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




function SyncDbPath(dbPath, modelObj, modelPath, enumerate) {
    // objects are passed by reference so we can observe db and modify model
    this.dbPath = dbPath;
    this.modelObj = modelObj;
    this.modelPath = modelPath;
    this.enumerate = enumerate;

    this.dbPathParts = dbPath.split('.');
    this.dbTargetProperty = this.dbPathParts[this.dbPathParts.length-1];
    this.modelPathParts = modelPath.split('.');
    this.modelTargetProperty = this.modelPathParts[this.modelPathParts.length-1];
    this.modelTarget = PathHelper.prototype.getTarget(this.modelObj, this.modelPathParts);
    console.log('   observing modelPath: ', this.modelPath, this.modelTargetProperty);
    Object.observe(this.modelTarget, this.modelObserver.bind(this));
    if(syncDb.db) {
        this.dbObj = syncDb.db;
        this.observeDbObject();
    }

    document.addEventListener('dbchanged', function (e) {
        this.dbObj = e.detail;
        this.observeDbObject();
    }.bind(this));

    this.cancelNextUpdate = false;
};
SyncDbPath.prototype.observeDbObject = function () {
    if(this.dbTarget)
        Object.unobserve(this.dbTarget, this.dbObserver.bind(this));
    if(this.dbTarget && this.enumerate)
        Object.unobserve(this.dbTarget[this.dbTargetProperty], this.enumerateObserver.bind(this));

    this.dbTarget = PathHelper.prototype.getTarget(this.dbObj, this.dbPathParts);
    this.setModelValue(this.getDbValue());
    //console.log('   observing dbPath: ', this.dbPath, ': ', JSON.stringify(this.dbTarget));

    Object.observe(this.dbTarget, this.dbObserver.bind(this));
    if(this.enumerate){
        Object.observe(this.dbTarget[this.dbTargetProperty], this.enumerateObserver.bind(this));
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
SyncDbPath.prototype.setModelValue = function (value) {
    if(this.enumerate) {
        this.enumerated = this.enumerateObj(value);
        this.modelTarget[this.modelTargetProperty] = this.enumerated;
    } else {
        this.modelTarget[this.modelTargetProperty] = value;
    }
};
SyncDbPath.prototype.modelObserver = function (changes) {
    changes.forEach(function(change) {
        //console.log('   model changed: ', change.type, change.name, change.oldValue, change.object[change.name]);
        if(change.name === this.modelTargetProperty && typeof change.oldValue !== 'undefined') {
//            if(this.cancelNextUpdate){
//                this.cancelNextUpdate = false;
//                console.log('       model update canceled: ', change.type, change.name, change.oldValue, change.object[change.name]);
//            } else {
                console.log('        sending model update: ', change.type, change.name, change.oldValue, change.object[change.name]);
                syncDb.update(this.dbPath, change.object[change.name]); // should be same as this.modelTarget[this.modelTargetProperty]
            //}

        }
    }.bind(this));
};
SyncDbPath.prototype.dbObserver = function (changes) {
    changes.forEach(function(change) {
        //console.log('   db changed1: ', change.type, change.name, change.oldValue, change.object[change.name], this.dbTargetProperty);
        if(change.name === this.dbTargetProperty) { // && typeof change.oldValue !== 'undefined')
            this.cancelNextUpdate = true;
            console.log('   db changed3: ', change.type, change.name, change.oldValue, change.object[change.name]);
            this.setModelValue(change.object[change.name]);
            console.log('   db changed4: ', change.type, change.name, change.oldValue, change.object[change.name]);
        }
    }.bind(this));
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



