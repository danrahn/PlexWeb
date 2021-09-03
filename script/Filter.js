/// <summary>
/// Base Filter class for tables that implement a filter.
///
/// Classes that extend this filter should implement the following:
/// - html() - The filter dialog UI
/// - populate() - Populate the filter dialog (from html()) with the current values
/// - get() - Retrieves the current filter from localStorage
/// - default() - Returns the default filter state
/// - getFromDialog() - Returns the new filter based on the current state of the filter dialog
/// </summary>

/* exported Filter */

/*eslint-disable class-methods-use-this */

class Filter
{
    constructor()
    {
        this.table = null;
    }

    setup()
    {
        $(".filterBtn").forEach(function(filterBtn)
        {
            filterBtn.addEventListener("click", this.launch.bind(this));
        }, this);

        document.body.addEventListener("keyup", this.tableFilterKeyHandler.bind(this));
    }

    /// <summary>
    /// Sets the table that this filter applies to
    /// </summary>
    setTable(table)
    {
        this.table = table;
    }

    /// <summary>
    /// Sets the current filter. No validation, but some basic validation
    /// should exist when grabbing the filter from localStorage
    /// </summary>
    /// <param name="update">
    /// If true, applies the new filter.
    /// False if we aren't ready to query the server for updated items yet
    /// </param>
    set(filter, update)
    {
        Log.verbose(filter, "Setting filter to");
        localStorage.setItem(this.table.idCore() + "_filter", JSON.stringify(filter));
        if (update)
        {
            this.table.clear();
            this.table.update();
        }
    }

    /// <summary>
    /// Wraps the given options in a common filter UI container
    /// </summary>
    htmlCommon(options)
    {
        let container = buildNode("div", { id : "filterContainer" }).appendChildren(
            buildNode("h3", {}, "Filter Options"),
            buildNode("hr")
        );

        options.forEach(function(option)
        {
            container.appendChild(option);
        });

        this._checkPerPageInFilter(container);

        const buildButton = (text, id, style="") => buildNode("input", {
            type : "button",
            value : text,
            id : id,
            style : style
        });

        let buttonHolder = buildNode("div", { class : "formInput" });
        let innerButtonHolder = buildNode("div", { class : "filterButtons" });
        innerButtonHolder.appendChildren(
            buildButton("Cancel", "cancelFilter", "margin-right: 10px"),
            buildButton("Reset", "resetFilter", "margin-right: 10px"),
            buildButton("Apply", "applyFilter")
        );

        return container.appendChildren(buttonHolder.appendChildren(innerButtonHolder));
    }

    /// <summary>
    /// In mobile view we don't show 'per page' directly in the table
    /// header to save space. Move it into the filter UI
    /// </summary>
    _checkPerPageInFilter(container)
    {
        if (getComputedStyle($$(".nomobile")).display != "inline")
        {
            container.appendChild(FilterUIBuilder.buildDropdown(
                "Show Per Page",
                {
                    25 : "25",
                    50 : "50",
                    100 : "100",
                    All : "0"
                }));

            container.appendChild(buildNode("hr"));
        }
    }

    /// <summary>
    /// Handle keystrokes
    /// </summary>
    tableFilterKeyHandler(e)
    {
        let key = e.keyCode ? e.keyCode : e.which;
        if (key == KEY.ENTER && e.ctrlKey)
        {
            let overlay = $("#filterOverlay");
            if (overlay && overlay.style.opacity == "1")
            {
                $("#applyFilter").click();
            }
        }
    }

    /// <summary>
    /// Launch the filter dialog and set up applicable event handlers
    /// </summary>
    launch()
    {
        Log.info(this);
        let overlay = this.html();

        // Somewhat hacky to do this here, but query selection doesn't
        // work until the item is actually added to the DOM
        let perPage = $("#showPerPage");
        if (perPage)
        {
            perPage.value = this.table.getPerPage();
        }

        let setup = {
            fn : this._setupFunction,
            args : [this]
        };

        Overlay.build({ dismissible : true, centered : false, noborder : true, setup : setup }, overlay);
    }

    _setupFunction(filter)
    {
        filter.populate();
        $("#applyFilter").addEventListener("click", function()
        {
            this.table.setPage(0);
            let applyPerPage = !!$("#showPerPage");
            this.set(this.getFromDialog(), !applyPerPage /*update*/);
            if (applyPerPage)
            {
                this.table.setPerPage($("#showPerPage").value, true /*update*/);
            }

            Overlay.dismiss();
        }.bind(filter));

        $("#cancelFilter").addEventListener("click", Overlay.dismiss);
        $("#resetFilter").addEventListener("click", function()
        {
            this.table.setPage(0);
            this.set(this.default(), true);
            Overlay.dismiss();
        }.bind(filter));

        // Set focus to the first input
        $("#mainOverlay").$$("input").focus();
    }

    /* Functions to be overridden */

    /// <summary>
    /// HTML for this filter
    /// </summary>
    html() { return this.htmlCommon([]); }

    /// <summary>
    ///  Populate the filter UI with the filter's current values
    /// </summary>
    populate() {}

    /// <summary>
    /// Return the stored filter state, or the default filter if it's not saved
    /// </summary>
    get() { return this.default(); }

    /// <summary>
    /// The default filter state
    /// </summary>
    default() { return {}; }

    /// <summary>
    /// Returns the current filter state based on the values in the filter dialog
    /// </summary>
    getFromDialog() { return this.default(); }
}
