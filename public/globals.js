function Globals() {
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
        formatDate: function (value) {
            return value ? moment(value).format('h:mma') : '';
        },
        formatDuration: function (value) {
            return value ? moment.utc(value).format('HH:mm') : '';
        }
    };
}

var posGlobals = new Globals();