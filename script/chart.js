/// <summary>
/// A basic charting library
///
/// Currently only supports pie charts
/// </summary>

/* eslint-disable id-length */ // svg elements often have single-digit identifiers
/* exported Chart */

// eslint-disable-next-line max-lines-per-function
let Chart = new function()
{
    /// <summary>
    /// Returns a pie chart in SVG form
    /// </summary>
    /// <param name="data">
    /// Required fields:
    ///  radius : the radius of the circle
    ///  points : the values to chart
    ///    Each point requires a 'value' and a 'label'
    ///
    /// Optional fields:
    ///  colors:
    ///    An array of colors to override the default choices
    ///  noSort:
    ///    If true, points will not be sorted before creating the chart
    /// </returns>
    this.pie = function(data)
    {
        if (!data.noSort)
        {
            data.points.sort((a, b) => a.value - b.value);
        }

        let total = data.points.reduce((acc, cur) => acc + cur.value, 0);

        let r = data.radius;
        let svg = makeSvg(r * 2, r * 2);
        let cumulative = 0;
        let colors = data.colors ? data.colors : ["#4472C4", "#ED7D31", "#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47"];
        let colorIndex = 0;
        for (let point of data.points)
        {
            let startPoint = getPoint(r, cumulative, total);
            let d = `M ${r} ${r} L ${startPoint.x} ${startPoint.y} `;

            cumulative += point.value;

            let endPoint = getPoint(r, cumulative, total);
            let sweep = (point.value > total / 2) ? "1" : "0";
            d += `A ${r} ${r} ${sweep} ${sweep} 0 ${endPoint.x} ${endPoint.y} `;
            d += `L ${endPoint.x} ${endPoint.y} ${r} ${r}`;
            svg.appendChild(buildNodeNS("http://www.w3.org/2000/svg",
                "path",
                {
                    d : d,
                    fill : colors[colorIndex++ % colors.length],
                    stroke : "#616161",
                    ttLabel : `${point.label} (${(point.value / total * 100).toFixed(2)}%)`,
                    "pointer-events" : "all",
                    xmlns : "http://www.w3.org/2000/svg"
                },
                0,
                {
                    mousemove : function(e) { showTooltip(e, this.getAttribute("ttLabel"), 50); },
                    mouseleave : dismissTooltip
                }));
        }
        return svg;
    };

    /// <summary>
    /// Given a value and total, returns a point on a circle of
    /// the given radius that is (value / total * 100) percent of the circle
    /// <summary>
    let getPoint = function(radius, value, total)
    {
        // Need to translate coordinate systems
        let angle = (value / total) * Math.PI * 2;
        let x = radius * Math.cos(angle) + radius;
        let y = radius - radius * Math.sin(angle);
        return { x : x, y : y };
    };

    /// <summary>
    /// Returns a top-level SVG container with the given width and height
    /// </summary>
    let makeSvg = function(width, height)
    {
        return buildNodeNS(
            "http://www.w3.org/2000/svg",
            "svg",
            {
                width : width,
                height : height,
                xmlns : "http://www.w3.org/2000/svg",
                x : 0,
                y : 0
            });
    };
}();
