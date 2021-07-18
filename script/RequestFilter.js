/// <summary>
/// Filter definition for the Requests table
/// </summary>

/* exported RequestFilter */

/* eslint-disable class-methods-use-this */

class RequestFilter extends UserFilter
{
    html()
    {
        let options = [];

        // Statuses + request types
        this._addFilterCheckboxes(options);

        options.push(buildNode("hr"));

        options.push(FilterUIBuilder.buildDropdown(
            "Sort By",
            {
                "Request Date" : "request",
                "Update Date" : "update",
                Title : "title"
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
        $("#showPending").checked = filter.status.pending;
        $("#showComplete").checked = filter.status.complete;
        $("#showDeclined").checked = filter.status.declined;
        $("#showInProgress").checked = filter.status.inprogress;
        $("#showWaiting").checked = filter.status.waiting;
        $("#showDeleted").checked = this._isAdmin() && filter.status.deleted;
        $("#showMovies").checked = filter.type.movies;
        $("#showTV").checked = filter.type.tv;
        $("#showAudiobooks").checked = filter.type.audiobooks;
        $("#showOther").checked = filter.type.other;
        $("#sortBy").value = filter.sort;
        $("#sortOrder").value = filter.order == "desc" ? "sortDesc" : "sortAsc";

        if (this._isAdmin())
        {
            this.populateUserFilter();
        }
        else
        {
            $("#showDeleted").parentNode.style.display = "none";
        }

        this._setSortOrderValues();
        $("#sortBy").addEventListener("change", this._setSortOrderValues);
    }

    get()
    {
        let filter = null;
        try
        {
            filter = JSON.parse(localStorage.getItem(this.table.idCore() + "_filter"));
        }
        catch (e)
        {
            Log.error("Unable to parse stored filter");
        }

        const ownProp = (item, property) => Object.prototype.hasOwnProperty.call(item, property);
        if (filter === null ||
            !ownProp(filter, "status") ||
                !ownProp(filter.status, "pending") ||
                !ownProp(filter.status, "complete") ||
                !ownProp(filter.status, "declined") ||
                !ownProp(filter.status, "inprogress") ||
                !ownProp(filter.status, "waiting") ||
                !ownProp(filter.status, "deleted") ||
            !ownProp(filter, "type") ||
                !ownProp(filter.type, "movies") ||
                !ownProp(filter.type, "tv") ||
                !ownProp(filter.type, "audiobooks") ||
                !ownProp(filter.type, "other") ||
            !ownProp(filter, "sort") ||
            !ownProp(filter, "order") ||
            !ownProp(filter, "user"))
        {
            if (filter === null)
            {
                Log.info("No filter found, creating default filter");
            }
            else
            {
                Log.error("Bad filter, resetting: ");
                Log.error(filter);
            }

            filter = this.default();
            this.set(filter, false /*update*/);
        }

        Log.verbose(filter, "Got Filter");
        return filter;
    }

    default()
    {
        return {
            status :
            {
                pending : true,
                complete : true,
                declined : true,
                inprogress : true,
                waiting : true,
                deleted : false,
            },
            type :
            {
                movies : true,
                tv : true,
                audiobooks : true,
                other : true
            },
            sort : "request",
            order : "desc",
            user : -1
        };
    }

    getFromDialog()
    {
        return {
            status :
            {
                pending : $("#showPending").checked,
                complete : $("#showComplete").checked,
                declined : $("#showDeclined").checked,
                inprogress : $("#showInProgress").checked,
                waiting : $("#showWaiting").checked,
                deleted : this._isAdmin() && $("#showDeleted").checked,
            },
            type :
            {
                movies : $("#showMovies").checked,
                tv : $("#showTV").checked,
                audiobooks : $("#showAudiobooks").checked,
                other : $("#showOther").checked,
            },
            sort : $("#sortBy").value,
            order : $("#sortOrder").value == "sortDesc" ? "desc" : "asc",
            user : this._isAdmin() ? $("#filterTo").value : "-1"
        };
    }

    _addFilterCheckboxes(options)
    {
        let checkboxes =
        {
            "Show Pending" : "showPending",
            "Show Waiting" : "showWaiting",
            "Show In Progress" : "showInProgress",
            "Show Complete" : "showComplete",
            "Show Declined" : "showDeclined",
            "Show Deleted" : "showDeleted",
            "" : "",
            "Show Movies" : "showMovies",
            "Show TV" : "showTV",
            "Show Audiobooks" : "showAudiobooks",
            "Show Other" : "showOther"
        };

        for (let [label, name] of Object.entries(checkboxes))
        {
            options.push(FilterUIBuilder.buildCheckbox(label, name));
        }
    }

    /// <summary>
    /// Adjusts the sort order text depending on the sort field
    /// </summary>
    _setSortOrderValues()
    {
        if ($("#sortBy").value == "title")
        {
            $("#sortDesc").text = "A-Z";
            $("#sortAsc").text = "Z-A";
        }
        else
        {
            $("#sortDesc").text = "Newest First";
            $("#sortAsc").text = "Oldest First";
        }
    }

    _isAdmin() { return parseInt(document.body.getAttribute("isAdmin")) === 1; }
}
