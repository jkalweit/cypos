/**
 * Created by jkalweit on 7/16/2014.
 */

var port = process.env.PORT || 1337;

var fs = require('fs');
var http = require('http');
var server = http.createServer(function (req, res) {

    var file = req.url;
    if (file == '/') file = '/index.html';

    fs.readFile('public' + file, function (err, data) {

        if (err) {
            res.writeHead(404);
            res.end(JSON.stringify(err));
            return;
        }

        res.writeHead(200);
        res.end(data);
    });

}).listen(port, '0.0.0.0');

var dbPath = 'db.json';

var db = {};

function throttle(fn, threshhold, scope) {
    // Taken from: http://remysharp.com/2010/07/21/throttling-function-calls/ -JDK 2014-07-20
    threshhold || (threshhold = 250);
    var last,
        deferTimer;
    return function () {
        var context = scope || this;

        var now = +new Date,
            args = arguments;
        if (last && now < last + threshhold) {
            // hold on to it
            clearTimeout(deferTimer);
            deferTimer = setTimeout(function () {
                last = now;
                fn.apply(context, args);
            }, threshhold);
        } else {
            last = now;
            fn.apply(context, args);
        }
    };
}

var saveDb = throttle(function () {
        fs.writeFile(dbPath, JSON.stringify(db), function (err) {
            if (err) {
                console.log('Error saving db: ' + err);
            } else {
                console.log('DB saved to: ' + dbPath);
            }
        });
    }, 1000);

function loadDb() {
    if (fs.existsSync(dbPath)) {
        db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        console.log('Loaded db from: ' + dbPath);
    } else {
        console.log('No db at: ' + dbPath);
    }
}

function getValue(path) {
    var parts = path.split('.');
    var value = null;
    if (parts.length > 0){
        if(!db.hasOwnProperty(parts[0]))
            db[parts[0]] = {};
        value = db[parts[0]];
    }
    for (var i = 1; i < parts.length; i++) {
        if (parts[i] && value.hasOwnProperty(parts[i]))
            value = value[parts[i]];
        else
            return null;
    }
    return value;
}

function getTarget(path, parts) {

    if (!parts.length) {
        console.log('path is empty!')
        return null;
    }

    var target = db;
    var currPart;
    for (var i = 0; i < parts.length - 1; i++) {
        currPart = parts[i];
        if (!target.hasOwnProperty(currPart)) // build path if doesn't exist
            target[currPart] = {};
        target = target[currPart];
    }

    return target;
}

function setValue(path, value) {
    var parts = path.split('.');
    var target = getTarget(path, parts);
    if(target) {
        target[parts[parts.length - 1]] = value;
        saveDb();
    }
}

function deleteValue(path) {
    var parts = path.split('.');
    var target = getTarget(path, parts);
    if(target) {
        delete target[parts[parts.length - 1]];
        saveDb();
    }
}




loadDb();


//db = {
//    customers: {
//        currId: 3,
//        '1': {
//            id: 1,
//            name: 'JUSTIN'
//        },
//        '2': {
//            id: 2,
//            name: 'BOB'
//        },
//        '3': {
//            id: 3,
//            name: 'STEVE'
//        }
//    }
//};




var io = require('socket.io')(server);

io.on('connection', function (socket) {
    console.log('a user connected');


    // for debugging
    socket.on('resetdb', function (id) {
        console.log('resetdb ' + id);
        db = {};
        saveDb();
    });


    socket.on('init', function (id, requestId) {
        console.log('init: ' + id);
        socket.emit('init', id, db, requestId);
    });

    socket.on('update', function (id, path, value, requestId) {
        console.log('   ' + id + ': ' + path + ': received update: ' + JSON.stringify(value));
        setValue(path, value)
        io.emit('update', id, path, value, requestId);
    });

    socket.on('delete', function (id, path, value, requestId) {
        console.log('   ' + id + ': ' + path + ': received delete: ' + JSON.stringify(value));
        deleteValue(path)
        io.emit('delete', id, path, value, requestId);
    });



    socket.on('additem', function (id, path, value, requestId) {
        console.log('adding item: ' + path);
        var list = getValue(path);
        if(!list)
            list = {};
        if (!list.currId)
            list.currId = 0;
        value.id = ++list.currId;
        list[value.id] = value;

        setValue(path, list);
        io.emit('update', id, path + '.' + value.id, value, requestId);
    });



    /***** App Specific Code *******/

});
