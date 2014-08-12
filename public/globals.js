function Globals() {

    function toTitleCase(str) {
        if(str)
            return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
    }

    this.formatters = {
        currency: {
            toDOM: function (value) {
                if(typeof value === 'undefined')
                    return '-';
                return '$' + Number(value).toFixed(2).toString();
            },
            toModel: function (value) {
                return value;
            }
        },
        uppercase: {
            toDOM: function (value) {
                if (value)
                    return value.toUpperCase();
            },
            toModel: function (value) {
                if (value)
                    return value.toUpperCase();
            }
        },
        titlecase: {
            toDOM: function (value) {
                return toTitleCase(value);
            },
            toModel: function (value) {
                return toTitleCase(value);
            }
        },
        formatDate: function (value) {
            //console.log('formatDate', value);
            return value ? moment(value).format('h:mma') : '';
        },
        formatDuration: function (value) {
            //console.log('formatDuration', value);
            return value ? moment.utc(value).format('HH:mm') : '';
        }
    };
}

var posGlobals = new Globals();