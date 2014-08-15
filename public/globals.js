function Globals() {

    function toTitleCase(str) {
        if (str)
            return str.replace(/\w\S*/g, function (txt) {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            });
    }

    this.helpers = {
        round: function (value, digits) {
            digits = digits || 2;
            return Number(Number(value).toFixed(digits));
        },
        getJsonFromUrl: function () {
            var query = location.search.substr(1);
            var result = {};
            query.split("&").forEach(function (part) {
                var item = part.split("=");
                result[item[0]] = decodeURIComponent(item[1]);
            });
            return result;
        }
    };

    this.formatters = {
        currency: {
            toDOM: function (value) {
                if (typeof value === 'undefined')
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
        formatDate: function (value, format) {
            format = format || 'h:mma';
            //console.log('formatDate', value);
            return value ? moment(value).format(format) : '';
        },
        formatDuration: function (value) {
            //console.log('formatDuration', value);
            return value ? moment.utc(value).format('HH:mm') : '';
        }
    };
}

var posGlobals = new Globals();