/// <summary>
/// Common table implementation, including interfaces for custom sorting, filtering, and searching.
///
/// Users of this interface should implement the following:
/// 1. identifier() - Returns a string that identifies this table (required)
/// 2. updateFunc() - Returns a function to call when updating the table (required)
/// 3. supportsSearch() - Returns whether searching the table is supported (optional, default=false)
/// 4. Filter - optional
///    a. html() - The filter dialog UI
///    b. populate() - Populate the filter dialog with the current values
///    c. get() - Retrieves the current filter from localStorage
///    d. default() - Returns the default filter state
///    b. getFromDialog() - Returns the new filter based on the current state of the filter dialog
/// </summary>

/* exported Table */

// eslint-disable-next-line max-lines-per-function
let Table = new function()
{
    /// <summary>
    /// On load set up all the handlers we need
    /// </summary>
    window.addEventListener("load", function()
    {
        setupPerPage();
        setupNavigation();
        setupTableSearch();
        Table.Filter.setup();
        setupKeyboardNavigation();
        setupDirectPageNavigation();
    });

    /// <summary>
    /// Global containing the total number of pages in the table
    /// </summary>
    let tablePages = 0;

    /// <summary>
    /// Clear out the current contents of the request table and replace it
    /// with a single informational message
    /// </summary>
    this.displayInfoMessage = function(message)
    {
        Table.clear();
        $("#tableEntries").appendChild(buildNode("div", { id : "resultInfo" }, message));
    };

    /// <summary>
    /// Set up click handlers for previous/next buttons
    /// </summary>
    let setupNavigation = function()
    {
        $(".previousPage").forEach(function(e)
        {
            e.addEventListener("click", Table.previousPage);
        });

        $(".nextPage").forEach(function(e)
        {
            e.addEventListener("click", Table.nextPage);
        });
    };

    /// <summary>
    /// Set up general keyboard navigation, and the handler for
    /// when the user goes to a specific page via the input dialog
    ///
    /// SHIFT + LEFT_ARROW - Previous Page
    /// SHIFT + RIGHT_ARROW - Next Page
    /// </summary>
    let setupKeyboardNavigation = function()
    {
        document.addEventListener("keyup", function(e)
        {
            // Don't do anything if we're in an input field
            let active = document.activeElement;
            let tag = active.tagName.toLowerCase();
            if (tag == "textarea" || (tag == "input" && active.type.toLowerCase() == "text"))
            {
                return;
            }

            let key = e.keyCode ? e.keyCode : e.which;
            if (e.shiftKey && !e.altKey && !e.ctrlKey)
            {
                switch (key)
                {
                    default:
                        break;
                    case KEY.LEFT:
                        Table.previousPage();
                        break;
                    case KEY.RIGHT:
                        Table.nextPage();
                        break;
                    case KEY.F:
                        if ($$(".filterBtn"))
                        {
                            $$(".filterBtn").click();
                        }

                        break;
                }
            }
        });
    };

    /// <summary>
    /// Sets up listeners for the direct page select text boxes
    /// </summary>
    let setupDirectPageNavigation = function()
    {
        $(".pageSelect").forEach(function(input)
        {
            input.addEventListener("keyup", function(e)
            {
                let key = e.keyCode ? e.keyCode : e.which;
                if (key == KEY.ENTER)
                {
                    let page = parseInt(this.value);
                    if (isNaN(page) || page <= 0 || page > tablePages)
                    {
                        this.value = Table.getPage() + 1;
                        this.select();
                        return;
                    }

                    Table.setPage(page - 1, true);
                    this.select();
                }
            });

            input.addEventListener("focus", function()
            {
                this.select();
            });
        });
    };

    /// <summary>
    /// Setup listeners for searching the table
    /// </summary>
    let setupTableSearch = function()
    {
        // If the table does not have a search function,
        // don't show anything. Might mess up CSS
        if (typeof(Table.supportsSearch) == "undefined" || !Table.supportsSearch())
        {
            $(".searchBtn").forEach(function(btn)
            {
                btn.style.display = "none";
            });

            return;
        }

        $(".searchBtn").forEach(function(btn)
        {
            btn.addEventListener("click", searchBtnClick);
        });

        $(".searchGo").forEach(function(btn)
        {
            btn.addEventListener("click", startTableSearch);
        });

        _setupSearchListeners();
    };

    /// <summary>
    /// Sets up search listeners to commit on enter/cancel on escape
    /// as well as setting up the click handler for the cancel button
    /// </summary>
    let _setupSearchListeners = function()
    {
        $(".searchInput").forEach(function(input)
        {
            input.addEventListener("keydown", function(e)
            {
                if (e.keyCode == KEY.ENTER)
                {
                    this.parentNode.$$(".searchGo").click();
                }
                else if (e.keyCode == KEY.ESC)
                {
                    this.value = "";
                    this.parentNode.parentNode.$$(".searchBtn").click();
                }
            });
        });

        $(".searchInputClear").forEach(function(img)
        {
            img.addEventListener("click", function()
            {
                let search = this.parentNode.$$(".searchInput");
                if (search.value.length != 0)
                {
                    this.parentNode.$$(".searchInput").value = "";
                    this.parentNode.$$(".searchGo").click();
                }

                this.parentNode.parentNode.$$(".searchBtn").click();
            });
        });

        $("#clearSearch").addEventListener("click", function()
        {
            $(".searchInput").forEach(function() { this.value = ""; });
            Table.update();
        });
    };

    /// <summary>
    /// Listener fired when the search button is clicked
    /// </summary>
    let searchBtnClick = function()
    {
        let show = !$$(".pageStatus").style.display || $$(".pageStatus").style.display != "none";
        $(".pageStatus").forEach(function(ele)
        {
            ele.style.display = show ? "none" : "inline-block";
        });

        $(".searchInputHolder").forEach(function(ele)
        {
            ele.style.display = show ? "inline-block" : "none";
        });

        if (show)
        {
            this.parentNode.$$(".searchInput").focus();
        }
    };

    /// <summary>
    /// Initiates a search. If the owner hasn't defined
    /// a search function, warn the user.
    /// </summary>
    let startTableSearch = function()
    {
        try
        {
            Table.update(this.parentNode.$$(".searchInput").value);
        }
        catch (e)
        {
            overlay("This table doesn't have search enabled (yet)", "OK", overlayDismiss);
        }
    };

    // eslint-disable-next-line max-lines-per-function
    this.Filter = new function()
    {
        /// <summary>
        /// Sets the current filter. No validation, but some basic validation
        /// should exist when grabbing the filter from localStorage
        /// </summary>
        /// <param name="update">
        /// If true, applies the new filter.
        /// False if we aren't ready to query the server for updated items yet
        /// </param>
        this.set = function(filter, update)
        {
            logVerbose(filter, "Setting filter to");
            localStorage.setItem(Table.idCore() + "_filter", JSON.stringify(filter));
            if (update)
            {
                Table.clear();
                Table.update();
            }
        };

        /// <summary>
        /// Setup filter button listeners. If no filter is found, hide the filter icons
        /// </summary>
        this.setup = function()
        {
            if (typeof(Table.Filter.html) == "undefined")
            {
                $(".filterBtn").forEach(function(filter)
                {
                    filter.style.display = "none";
                });

                return;
            }

            $(".filterBtn").forEach(function(filter)
            {
                filter.addEventListener("click", launch);
            });

            document.body.addEventListener("keyup", tableFilterKeyHandler);
        };

        /// <summary>
        /// Wraps the given options in a common filter UI container
        /// </summary>
        this.htmlCommon = function(options)
        {
            let container = buildNode("div", { id : "filterContainer" }).appendChildren(
                buildNode("h3", {}, "Filter Options"),
                buildNode("hr")
            );

            options.forEach(function(option)
            {
                container.appendChild(option);
            });

            _checkPerPageInFilter(container);

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
        };

        /// <summary>
        /// In mobile view we don't show 'per page' directly in the table
        /// header to save space. Move it into the filter UI
        /// </summary>
        let _checkPerPageInFilter = function(container)
        {
            if (getComputedStyle($$(".nomobile")).display != "inline")
            {
                container.appendChild(Table.Filter.buildDropdown(
                    "Show Per Page",
                    {
                        25 : "25",
                        50 : "50",
                        100 : "100",
                        All : "0"
                    }));

                container.appendChild(buildNode("hr"));
            }
        };

        /// <summary>
        /// Handle keystrokes
        /// </summary>
        let tableFilterKeyHandler = function(e)
        {
            let key = e.keyCode ? e.keyCode : e.which;
            if (key == KEY.ESC)
            {
                dismiss();
            }
            else if (key == KEY.ENTER && e.ctrlKey)
            {
                let overlay = $("#filterOverlay");
                if (overlay && overlay.style.opacity == "1")
                {
                    $("#applyFilter").click();
                }
            }
        };

        /// <summary>
        /// Launch the filter dialog and set up applicable event handlers
        /// </summary>
        let launch = function()
        {
            let overlay = _buildAndAttachFilterOverlay();

            // Somewhat hacky to do this here, but query selection doesn't
            // work until the item is actually added to the DOM
            let perPage = $("#showPerPage");
            if (perPage)
            {
                perPage.value = Table.getPerPage();
            }

            Table.Filter.populate();
            $("#applyFilter").addEventListener("click", function()
            {
                Table.setPage(0);
                let applyPerPage = !!$("#showPerPage");
                Table.Filter.set(Table.Filter.getFromDialog(), !applyPerPage /*update*/);
                if (applyPerPage)
                {
                    setPerPage($("#showPerPage").value, true /*update*/);
                }

                dismiss();
            });

            $("#cancelFilter").addEventListener("click", dismiss);
            $("#resetFilter").addEventListener("click", function()
            {
                Table.setPage(0);
                Table.Filter.set(Table.Filter.default(), true);
                dismiss();
            });

            Animation.queue({ opacity : 1 }, overlay, 250);

            // Set focus to the first input
            overlay.$$("input").focus();
        };

        /// <summary>
        /// Dismisses the filter overlay with an animation if it's present
        /// </summary>
        let dismiss = function()
        {
            let overlay = $("#filterOverlay");
            if (overlay && overlay.style.opacity == "1")
            {
                Animation.queue({ opacity : 0 }, overlay, 250, true);
            }
        };

        /// <summary>
        /// Build and return the filter dialog element
        /// </summary>
        let _buildAndAttachFilterOverlay = function()
        {
            let overlay = buildNode(
                "div",
                { id : "filterOverlay", style : "opacity: 0" },
                Table.Filter.html().outerHTML,
                {
                    click : function(e)
                    {
                        // A click outside the main dialog will dismiss it
                        if (e.target.id == "filterOverlay")
                        {
                            dismiss();
                        }
                    }
                }
            );

            document.body.appendChild(overlay);
            return overlay;
        };

        /// <summary>
        /// Get a list of all the users to populate the admin-only filter option
        /// </summary>
        this.populateUserFilter = function()
        {
            let params = { type : ProcessRequest.GetAllMembers };
            let successFunc = function(response)
            {
                let select = $("#filterTo");
                response.forEach(function(user)
                {
                    select.appendChild(buildNode("option", { value : user.id }, user.username));
                });

                select.value = Table.Filter.get().user;
            };

            let failureFunc = function()
            {
                Animation.queue({ backgroundColor : "rgb(100, 66, 69)" }, $("#filterTo"), 500);
                Animation.queueDelayed({ backgroundColor : "rgb(63, 66, 69)" }, $("#filterTo"), 1000, 500, true);
            };

            sendHtmlJsonRequest("process_request.php", params, successFunc, failureFunc);
        };

        /// <summary>
        /// Returns a checkbox filter item with the given label and name
        /// If the name is empty, return an hr instead
        /// </summary>
        this.buildCheckbox = function(label, name)
        {
            if (name == "")
            {
                return buildNode("hr");
            }

            let div = buildNode(
                "div",
                { class : "formInput" },
                0,
                {
                    click : function(e)
                    {
                        // If we clicked the filter item but not directly on the label.checkbox, pretend we did
                        if (e.target == this)
                        {
                            this.$$("input").click();
                        }
                    }
                }
            );

            return div.appendChildren(
                buildNode("label", { for : name }, label + ": "),
                buildNode(
                    "input",
                    {
                        type : "checkbox",
                        name : name,
                        id : name
                    }
                )
            );
        };

        /// <summary>
        /// Builds a filter dropdown
        /// </summary>
        /// <param name="title">The label for the dropdown</param>
        /// <param name="options">A dictionary of options mapping labels to their associated values</param>
        /// <param name="addId">If true, adds an id to each option that equals the option's value</param>
        this.buildDropdown = function(title, options, addId=false)
        {
            // Make the name the camelCase version of the title
            let name = title.split(" ");
            name = name.splice(0, 1)[0].toLowerCase() + name.join("");
            let container = buildNode("div", { class : "formInput" });
            container.appendChild(buildNode("label", { for : name }, title + ": "));
            let select = buildNode("select", { name : name, id : name });
            for (let [label, value] of Object.entries(options))
            {
                let option = buildNode("option", { value : value }, label);
                if (addId)
                {
                    option.id = value;
                }

                select.appendChild(option);
            }

            return container.appendChildren(select);
        };
    }();

    /// <summary>
    /// Navigate to the previous page if we're not on the first page
    /// </summary>
    this.previousPage = function()
    {
        let page = Table.getPage();
        if (page <= 0)
        {
            return;
        }

        Table.setPage(page - 1, true);
    };

    /// <summary>
    /// Navigate to the next page if we're not on the last page
    /// </summary>
    this.nextPage = function()
    {
        let page = Table.getPage();
        if (page == tablePages - 1)
        {
            return;
        }

        Table.setPage(page + 1, true);
    };

    /// <summary>
    /// Returns the identifier for this table, or a 'shared' id
    /// if no id has been provided
    /// </summary>
    this.idCore = function()
    {
        if (typeof(Table.identifier) == "undefined")
        {
            return "table_shared";
        }

        return "table_" + Table.identifier();
    };

    /// <summary>
    /// Returns the user's current page
    /// </summary>
    this.getPage = function()
    {
        let page = parseInt(localStorage.getItem(Table.idCore() + "_page"));
        if (page === null || isNaN(page) || page < 0)
        {
            page = 0;
            Table.setPage(page);
        }

        return page;
    };

    /// <summary>
    /// Set the number of items to show per page
    /// </summary>
    /// <param name="update">
    /// If true, applies the new perPage setting
    /// False if we aren't ready to change pages yet
    /// </param>
    this.setPage = function(page, update)
    {
        localStorage.setItem(Table.idCore() + "_page", page);
        if (update)
        {
            Table.clear();
            Table.update();
        }

        if (page == 0)
        {
            $(".previousPage").forEach(function(button)
            {
                button.classList.add("disabled");
                button.disabled = true;
            });
        }
        else
        {
            $(".previousPage").forEach(function(button)
            {
                button.classList.remove("disabled");
                button.disabled = false;
            });
        }

        if (page == tablePages - 1)
        {
            $(".nextPage").forEach(function(button)
            {
                button.classList.add("disabled");
                button.disabled = true;
            });
        }
        else
        {
            $(".nextPage").forEach(function(button)
            {
                button.classList.remove("disabled");
                button.disabled = false;
            });
        }
    };

    /// <summary>
    /// Returns the number of items per page the user wants to see
    /// </summary>
    this.getPerPage = function()
    {
        let storage = Table.idCore() + "_perPage";
        let perPage = parseInt(localStorage.getItem(storage));
        if (perPage === null || isNaN(perPage) || perPage % 25 != 0 || perPage < 0)
        {
            localStorage.setItem(storage, 25);
            perPage = 25;
        }

        return perPage;
    };

    /// <summary>
    /// Set the number of items to show per page
    /// </summary>
    /// <param name="update">
    /// If true, applies the new perPage setting
    /// False if we aren't ready to query the server for updated items yet
    /// </param>
    let setPerPage = function(newPerPage, update)
    {
        localStorage.setItem(Table.idCore() + "_perPage", newPerPage);
        $(".perPageButton").forEach((btn) =>
        {
            btn.classList.remove("selected");
        });

        $(`.perPageButton[value="${newPerPage}"]`).forEach(function(e)
        {
            e.classList.add("selected");
        });

        if (update)
        {
            Table.clear();
            Table.update();
        }
    };

    /// <summary>
    /// Sets up click handlers for per-page options
    /// </summary>
    let setupPerPage = function()
    {
        if (typeof(Table.getPerPage) == "undefined")
        {
            $(".perPageHolder").forEach(function(holder)
            {
                holder.style.display = "none";
            });

            return;
        }

        let perPage = Table.getPerPage();

        $(".perPageButton").forEach((btn) =>
        {
            btn.addEventListener("click", function()
            {
                let newPerPage = parseInt(this.value);
                if (newPerPage === null || isNaN(newPerPage) || newPerPage % 25 != 0 || newPerPage < 0)
                {
                    newPerPage = 25;
                }

                setPerPage(newPerPage, true);
            });
        });

        setPerPage(perPage, false);
    };

    /// <summary>
    /// Update the "Page X of Y" strings in the table
    /// </summary>
    this.setPageInfo = function(totalRequests)
    {
        tablePages = Table.getPerPage() == 0 ? 1 : Math.ceil(totalRequests / Table.getPerPage());
        $(".pageSelect").forEach(function(e)
        {
            e.value = Table.getPage() + 1;
        });

        $(".pageCount").forEach(function(e)
        {
            e.innerHTML = tablePages;
        });

        Table.setPage(Table.getPage(), false);
    };

    /// <summary>
    /// Invokes the table update callback and sets the search string header visibility
    /// </summary>
    this.update = function(searchValue="")
    {
        let header = $("#requestSearch");
        if (searchValue.length == 0)
        {
            header.style.display = "none";
        }
        else
        {
            header.style.display = "block";
            $("#searchTerm").innerHTML = searchValue;
        }

        Table.updateFunc()(searchValue);
    };

    // Store tableEntries outside of addItem so we don't
    // have to continuously query for it when bulk adding table entries
    let tableEntries = $("#tableEntries");
    this.addItem = function(element)
    {
        tableEntries.appendChild(element);
    };

    /// <summary>
    /// Return a table entry's holder element
    /// </summary>
    this.itemHolder = function()
    {
        return buildNode("div", { class : "tableEntryHolder" });
    };

    /// <summary>
    /// Remove all entries from the table
    /// </summary>
    this.clear = function()
    {
        let entries = $("#tableEntries");
        while (entries.firstChild)
        {
            entries.removeChild(entries.firstChild);
        }
    };
}();
