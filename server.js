/**
 * Created by jkalweit on 7/16/2014.
 */

var port = process.env.PORT || 1337;

var printer = require('printer/printer.js');

var fs = require('fs');
var http = require('http');
var server = http.createServer(function (req, res) {

    var url = req.url;
    if(url.indexOf('?') > -1)
        url = url.substr(0, url.indexOf('?'));

    var file = url;
    if (file == '/') file = '/index.html';
    if (file == '/bar') file = '/bar.html';
    if (file == '/kitchen') file = '/kitchen.html';
    if (file == '/rec') file = '/rec.html'

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
        setValue(path, value);
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

    socket.on('closereconciliation', function (id, requestId) {

        console.log('closing rec');

        if(!db.reconciliations.current) {
            console.log('ERROR: no rec');
            return;
        }

        var current = db.reconciliations.current;

        current.closeddate = new Date();

        if(!db.reconciliations.history) {
            db.reconciliations.history = {
                currId: 0
            };
        }

        var history = db.reconciliations.history;

        current.id = ++history.currId;
        current.customers = db.customers;
        current.menu = db.menu;
        history[current.id] = current;
        delete db.customers;
        delete db.reconciliations.current;

        db.status.recIsOpen = false;
        socket.emit('update', id, 'status.recIsOpen', db.status.recIsOpen, requestId);
        //socket.emit('update', id, 'reconciliations.current.closeddate', current.closeddate, requestId);
        console.log('rec closed');
    }.bind());

    socket.on('print', function (id, job, requestId) {

        printer.printDirect({data: job.data, printer: job.printer, type: "RAW", success: function () {
            console.log('printed to printer: ', job.printer);
        }, error: function (err) {
            console.log('Error while printing: ', err);
        }
        });
    });

});


