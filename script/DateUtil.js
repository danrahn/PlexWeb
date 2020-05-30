let DateUtil =
{
    /// <summary>
    /// Determine how long ago a date is from the current time.
    /// Returns a string of the form "X [time units] ago"
    /// </summary>
    getDisplayDate: function(date)
    {
        if (typeof(date) == 'string')
        {
            date = new Date(date);
        }

        let now = new Date();
        let dateDiff = Math.abs(now - date);
        if (dateDiff < 15000)
        {
            return 'Just Now';
        }
        else if (dateDiff < 60000)
        {
            return `${Math.floor(dateDiff / 1000)} seconds ago`;
        }

        let minuteDiff = dateDiff / (1000 * 60);
        if (minuteDiff < 60)
        {
            let minutes = Math.floor(minuteDiff);
            return `${minutes} minute${minutes == 1 ? "" : "s"} ago`;
        }
        
        let hourDiff = minuteDiff / 60;
        if (hourDiff < 24)
        {
            let hours = Math.floor(hourDiff);
            return `${hours} hour${hours == 1 ? "" : "s"} ago`;
        }

        let dayDiff = hourDiff / 24;
        if (dayDiff < 7)
        {
            let days = Math.floor(dayDiff);
            return `${days} day${days == 1 ? "" : "s"} ago`;
        }

        if (dayDiff <= 28)
        {
            // For weeks do some extra approximation, as it's odd to see
            // "1 week ago" for something created 13 days ago
            let weeks = Math.floor((dayDiff + 3) / 7);
            return `${weeks} week${weeks == 1 ? '' : 's'} ago`;
        }

        if (dayDiff < 365)
        {
            let months = (now.getMonth() + (now.getFullYear() != date.getFullYear() ? 12 : 0)) - date.getMonth();
            return `${months == 0 ? 1 : months} month${months == 1 ? '' : 's'} ago`;
        }

        let yearDiff = now.getFullYear() - date.getFullYear();
        return `${yearDiff == 0 ? 1 : yearDiff} year${yearDiff == 1 ? '' : 's'} ago`;
    },

    getFullDate: function(date)
    {
        if (typeof(date) == 'string')
        {
            date = new Date(date);
        }
        let tooltipDateOptions = { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' };
        return date.toLocaleDateString('en-US', tooltipDateOptions);
    }
};