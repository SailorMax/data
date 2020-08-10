//export default
class Covid19SingleTooltip
{
	constuctor()
	{
		this.activeHint = null;
		this.activeHintOwner = null;
	}

	ShowHideHint(sender, data, idx, els_list)
	{
		if (els_list && (els_list.length > 1) && (els_list[0].tagName == "rect") && (d3.select(els_list[0]).attr("x") == d3.select(els_list[1]).attr("x"))) // multiple bars
		{
			sender = els_list[0].parentNode;
		}

		if (this.activeHintOwner !== sender)
		{
			this.HideHint();	// has to be after check `activeHintOwner`
			this.ShowHint(sender, data, idx, els_list);
		}
		else
			this.HideHint();
	}

	ShowHint(sender, data, idx, els_list)
	{
		var x_scroll = document.documentElement.scrollLeft || document.body.scrollLeft;
		var y_scroll = document.documentElement.scrollTop || document.body.scrollTop;
		var sender_coords;
		var title;

		if (!els_list)	// regular link
		{
			sender_coords = sender.getBoundingClientRect();
			// add little spaces between hint and element
			sender_coords.width += 6;
			sender_coords.x -= 3;
			//
			title = data;
		}
		else if ((els_list.length > 1) && (els_list[0].tagName == "rect") && d3.select(els_list[0]).attr("x") == d3.select(els_list[1]).attr("x")) // multiple bars
		{
			sender = els_list[0].parentNode;
			sender_coords = {x:0, y:0, width:0, height:0};
			var el_position = els_list[0].getBoundingClientRect();
			sender_coords.x = el_position.x;
			sender_coords.y = el_position.y;
			sender_coords.width = el_position.width;
			sender_coords.height = els_list.reduce( (height, el) => height + el.getBoundingClientRect().height, 0 );

			title = els_list.reduce( (titles, el) => { titles.push( d3.select(el).select("title").text() ); return titles; }, [] ).join("<br />\n");
		}
		else if ((els_list[0].tagName == "rect") && data[1] && data.data) // stack
		{
			var el_idx = els_list.findIndex( el => el === sender );
			var stacks_box = els_list[0].parentNode.parentNode;
			var bars = d3.select(stacks_box).selectAll("rect:nth-child("+(el_idx+1)+")").nodes().reverse();

			sender_coords = {x:0, y:0, width:0, height:0};
			var el_position = bars[0].getBoundingClientRect();
			sender_coords.x = el_position.x;
			sender_coords.y = el_position.y;
			sender_coords.width = el_position.width;
			sender_coords.height = bars.reduce( (height, el) => height + el.getBoundingClientRect().height, 0 );

			title = bars.reduce( (titles, el) => { titles.push( d3.select(el).select("title").text() ); return titles; }, [] ).join("<br />\n");
		}
		else // single bar
		{
			sender_coords = sender.getBoundingClientRect();
			title = d3.select(sender).select("title").text();
		}

		var x_pos = (x_scroll + sender_coords.x + sender_coords.width + 3);		// 3px - arrow
		var y_pos = (y_scroll + sender_coords.y + (sender_coords.height/2));
		var d3_tooltip = d3.create("SPAN")
								.attr("class", "Cv19SMWtooltiptext Cv19SMWtooltip-right")
								.style("top", "0px")						// later, when we will know size of element
								.style("left", x_pos+"px")
								.html(title)
								;
		if (title.indexOf("\n") === -1)
			d3_tooltip.style("text-align", "center");

		var tooltip = document.body.appendChild( d3_tooltip.node() );

		// reposition, based on hint size
		var hint_size = tooltip.getBoundingClientRect();
		if (hint_size.width < sender_coords.x)
		{
			tooltip.classList.remove("Cv19SMWtooltip-right");
			tooltip.classList.add("Cv19SMWtooltip-left");
			tooltip.style.left = (x_scroll + sender_coords.x - hint_size.width - 3)+"px";	// 3px - arrow
		}
		tooltip.style.top = (y_pos - hint_size.height/2)+"px";

		// show it
		window.setTimeout(() => tooltip.classList.add("visible"), 1 );
		this.activeHint = tooltip;
		this.activeHintOwner = sender;
	}

	HideHint()
	{
		if (!this.activeHint)
			return;

		this.activeHint.parentNode.removeChild(this.activeHint);
		this.activeHint = null;
		this.activeHintOwner = null;
	}
}
