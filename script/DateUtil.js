/// <summary>
/// Pretty-print date functions
/// </summary>

/* exported DateUtil */

/* eslint-disable-next-line max-lines-per-function */
let DateUtil = new function()
{
    /// <summary>
    /// Determine how long ago a date is from the current time.
    /// Returns a string of the form "X [time units] ago"
    /// </summary>
    this.getDisplayDate = function(date)
    {
        if (typeof(date) == "string")
        {
            date = new Date(date);
        }

        let now = new Date();
        let dateDiff = Math.abs(now - date);
        if (dateDiff < 15000)
        {
            return "Just Now";
        }

        let underOneWeek = _checkDate(dateDiff /= 1000, 60, "second") ||
            _checkDate(dateDiff /= 60, 60, "minute") ||
            _checkDate(dateDiff /= 60, 24, "hour") ||
            _checkDate(dateDiff /= 24, 7, "day");

        if (underOneWeek)
        {
            return underOneWeek;
        }

        if (dateDiff <= 28)
        {
            // For weeks do some extra approximation, as it's odd to see
            // "1 week ago" for something created 13 days ago
            let weeks = Math.floor((dateDiff + 3) / 7);
            return `${weeks} week${weeks == 1 ? "" : "s"} ago`;
        }

        if (dateDiff < 365)
        {
            let months = (now.getMonth() + (now.getFullYear() == date.getFullYear() ? 0 : 12)) - date.getMonth();
            return `${months == 0 ? 1 : months} month${months == 1 ? "" : "s"} ago`;
        }

        let yearDiff = now.getFullYear() - date.getFullYear();
        return `${yearDiff == 0 ? 1 : yearDiff} year${yearDiff == 1 ? "" : "s"} ago`;
    };

    /// <summary>
    /// Returns the full date, 'Month d, yyyy, h:mm [AM|PM]'
    /// </summary>
    this.getFullDate = function(date)
    {
        if (typeof(date) == "string")
        {
            date = new Date(date);
        }

        let tooltipDateOptions =
        {
            month : "long",
            day : "numeric",
            year : "numeric",
            hour : "numeric",
            minute : "numeric"
        };

        return date.toLocaleDateString("en-US", tooltipDateOptions);
    };

    /// <summary>
    /// Helper that returns the 'xyz ago' string if it's below the cutoff
    /// </summary>
    let _checkDate = function(value, cutoff, stringVal)
    {
        if (value < cutoff)
        {
            let count = Math.floor(value);
            return `${count} ${stringVal}${count == 1 ? "" : "s"} ago`;
        }

        return "";
    };
}();
