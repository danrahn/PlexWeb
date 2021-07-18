/// <summary>
/// Filter implementation for the Activity table
/// </summary>

/* exported ActivityFilter */

/* eslint-disable class-methods-use-this */

class ActivityFilter extends UserFilter
{
    html()
    {
        let options = [];

        // Statuses + request types
        let checkboxes =
        {
            "Show New Requests" : "showNew",
            "Show Comments" : "showComment",
            "Show Status Changes" : "showStatus",
            "Show My Actions" : "showMine"
        };

        for (let [label, name] of Object.entries(checkboxes))
        {
            options.push(FilterUIBuilder.buildCheckbox(label, name));
        }

        options.push(FilterUIBuilder.buildDropdown(
            "Sort By",
            {
                Date : "request"
            }));

        options.push(FilterUIBuilder.buildDropdown(
            "Sort Order",
            {
                "Newest First" : "sortDesc",
                "Oldest First" : "sortAsc"
            },
            true /*addId*/));

        options.push(buildNode("hr"));

        if (this._isAdmin())
        {
            options.push(FilterUIBuilder.buildDropdown(
                "Filter To",
                {
                    All : -1
                }));

            options.push(buildNode("hr"));
        }

        return this.htmlCommon(options);
    }

    populate()
    {
        let filter = this.get();
        $("#showNew").checked = filter.type.new;
        $("#showComment").checked = filter.type.comment;
        $("#showStatus").checked = filter.type.status;
        $("#showMine").checked = filter.type.mine;
        $("#sortBy").value = filter.sort;
        $("#sortOrder").value = filter.order == "desc" ? "sortDesc" : "sortAsc";

        if (this._isAdmin())
        {
            this.populateUserFilter();
        }
    }

    get()
    {

        let filter = null;
        try
        {
            filter = JSON.parse(localStorage.getItem(this.table.idCore() + "_filter"));
        }
        catch (exception)
        {
            Log.error("Unable to parse stored filter");
        }

        const hasProp = (item, property) => Object.prototype.hasOwnProperty.call(item, property);
        if (filter === null ||
            !hasProp(filter, "type") ||
                !hasProp(filter.type, "new") ||
                !hasProp(filter.type, "comment") ||
                !hasProp(filter.type, "status") ||
                !hasProp(filter.type, "mine") ||
            !hasProp(filter, "sort") ||
            !hasProp(filter, "order") ||
            !hasProp(filter, "user"))
        {
            Log.error("Bad filter, resetting: ");
            Log.error(filter);
            filter = this.default();
            this.set(filter, false);
        }

        Log.verbose(filter, "Got Filter");
        return filter;
    }

    default()
    {
        return {
            type :
            {
                new : true,
                comment : true,
                status : true,
                mine : true
            },
            sort : "request",
            order : "desc",
            user : -1
        };
    }

    getFromDialog()
    {
        return {
            type :
            {
                new : $("#showNew").checked,
                comment : $("#showComment").checked,
                status : $("#showStatus").checked,
                mine : $("#showMine").checked
            },
            sort : $("#sortBy").value,
            order : $("#sortOrder").value == "sortDesc" ? "desc" : "asc",
            user : this._isAdmin() ? $("#filterTo").value : "-1"
        };
    }

    _isAdmin() { return parseInt(document.body.getAttribute("admin")) === 1; }
}
