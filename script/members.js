window.addEventListener('load', function()
{
    getMembers();
});

function tableIdentifier()
{
    return 'members';
}

function tableUpdateFunc()
{
    return getMembers;
}

function getMembers(searchValue='')
{
    let parameters =
    {
        'type' : ProcessRequest.GetMembers,
        'num' : getPerPage(),
        'page' : getPage(),
        'search' : searchValue,
        'filter' : JSON.stringify(getFilter())
    };

    displayInfoMessage('Loading...');
    let successFunc = function(response)
    {

        buildMembers(response.data);
        setPageInfo(response.total);

        if (searchValue.length != 0)
        {
            $$('.searchBtn').click();
        }
    };

    let failureFunc = function()
    {
        displayInfoMessage('Something went wrong :(');
    };

    sendHtmlJsonRequest('process_request.php', parameters, successFunc, failureFunc);
}

function buildMembers(members)
{
    clearElement('tableEntries');
    if (members.length == 0)
    {
        displayInfoMessage('No members returned. That can\'t be right!');
        return;
    }

    members.forEach(function(member)
    {
        let holder = tableItemHolder();
        let title = buildNode('div', { 'class' : 'memberTitle' });
        title.appendChild(buildNode(
            'span',
            { 'id' : 'member_' + member.id, 'class' : 'memberExpand' },
            '+',
            {
                'click' : expandContractMember
            }));

        let user = buildNode('span', { 'class' : 'memberName' }, member.username);
        if (member.level >= 100)
        {
            user.classList.add('adminName');
        }
        else if (member.level == 0)
        {
            user.classList.add('newName');
        }

        title.appendChild(user);
        holder.appendChild(title);

        let list = buildNode('ul', { 'class' : 'memberDetails' });
        const li = (label, value) => buildNode('li', {}, label + ': ' + value);
        let lastSeen = li('Last Seen', DateUtil.getDisplayDate(member.last_seen));
        setTooltip(lastSeen, DateUtil.getFullDate(member.last_seen));
        list.appendChild(lastSeen);

        if (member.name.trim().length > 0)
        {
            list.appendChild(li('Name', member.name));
        }

        if (member.email.length > 0)
        {
            list.appendChild(li('Email', member.email));
        }

        if (member.phone != 0)
        {
            let phone = "(" + member.phone.substring(0, 3) + ") " + member.phone.substring(3, 6) + "-" + member.phone.substring(6);
            list.appendChild(li('Phone', phone));
        }

        list.appendChild(buildNode('li', {}, `ID: ${member.id}`));
        list.appendChild(buildNode('li', {}, `Level: ${member.level}`));

        holder.appendChild(list);
        addTableItem(holder);
    });
}

function expandContractMember()
{
    if (this.innerHTML == '+')
    {
        this.innerHTML = '-';
        this.parentNode.parentNode.$$('.memberDetails').style.display = 'block';
    }
    else
    {
        this.innerHTML = '+';
        this.parentNode.parentNode.$$('.memberDetails').style.display = 'none';
    }
}

function populateFilter()
{
    let filter = getFilter();
    $('#showNew').checked = filter.type.new;
    $('#showRegular').checked = filter.type.regular;
    $('#showAdmin').checked = filter.type.admin;
    $('#hasPII').value = filter.pii;
    $('#sortBy').value = filter.sort;
    $('#sortOrder').value = filter.order == 'desc' ? 'sortDesc' : 'sortAsc';

    setSortOrderValues();
    $('#sortBy').addEventListener('change', setSortOrderValues);
}

function getNewFilter()
{
    return {
        'type' :
        {
            'new' : $('#showNew').checked,
            'regular' : $('#showRegular').checked,
            'admin' : $('#showAdmin').checked
        },
        'pii' : $('#hasPII').value,
        'sort' : $('#sortBy').value,
        'order' : $("#sortOrder").value == 'sortDesc' ? 'desc' : 'asc'
    };
}

function setSortOrderValues()
{
    let sortBy = $('#sortBy').value;
    if (sortBy == 'level')
    {
        $('#sortDesc').text = 'Highest to Lowest';
        $('#sortAsc').text = 'Lowest to Highest';
    }
    else if (sortBy == 'name')
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

function filterHtml()
{
    let options = [];

    let checkboxes =
    {
        'New Members' : 'showNew',
        'Regulars' : 'showRegular',
        'Admins' : 'showAdmin'
    };

    for (let [label, name] of Object.entries(checkboxes))
    {
        options.push(buildTableFilterCheckbox(label, name));
    }

    options.push(buildNode('hr'));

    options.push(buildTableFilterDropdown(
        'Has PII',
        {
            'All' : 'all',
            'Yes' : 'yes',
            'No' : 'no'
        }));
    options.push(buildNode('hr'));

    options.push(buildTableFilterDropdown(
        'Sort By',
        {
            'Account Age' : 'id',
            'Name' : 'name',
            'Last Seen' : 'seen',
            'Level' : 'level',
        }));

    options.push(buildTableFilterDropdown(
        'Sort Order',
        {
            'Newest First' : 'sortDesc',
            'Oldest First' : 'sortAsc'
        },
        true /*addId*/));
    options.push(buildNode('hr'))

    return filterHtmlCommon(options);
}

function hasProp(item, property)
{
    return item.hasOwnProperty(property);
}

function getFilter()
{
    let filter = null;
    try
    {
        filter = JSON.parse(localStorage.getItem(tableIdCore() + '_filter'));
    }
    catch (e)
    {
        logError('Unable to parse stored filter, resetting');
    }

    if (filter == null ||
        !hasProp(filter, 'type') ||
            !hasProp(filter.type, 'new') ||
            !hasProp(filter.type, 'regular') ||
            !hasProp(filter.type, 'admin') ||
        !hasProp(filter, 'pii') ||
        !hasProp(filter, 'sort') ||
        !hasProp(filter, 'order'))
    {
        if (filter != null)
        {
            logError(filter, 'Bad filter, resetting');
        }

        filter = defaultFilter();
        setFilter(filter, false);
    }

    logVerbose(filter, 'Got Filter');
    return filter;
}

function defaultFilter()
{
    return {
        'type' :
        {
            'new' : true,
            'regular' : true,
            'admin' : true
        },
        'pii' : 'all',
        'sort' : 'id',
        'order' : 'asc'
    };
}

function tableSearch(value)
{
    getMembers(value);
}
