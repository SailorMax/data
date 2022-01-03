const Covid19DataTools = {
	formatDate:			d3.timeFormat("%d.%m"),
	formatMonth:		d3.timeFormat("%m.%y"),
	formatMonthYear:	d3.timeFormat("%m.%Y"),
	formatMonthOnly:	d3.timeFormat("%m"),
	formatYearOnly:		d3.timeFormat("%Y"),
	numberFormat:		d3.format(","),
	largeNumberFormat:	d3.format(",.3s"),
	percentFormat:		d3.format(",.0%"),
	minimizeFloat:		d3.format(",.2f"),
	largetNumberLimiter:100000,

	GetFormattedNumber: function(num, full)
	{
		return (Math.abs(num) >= this.largetNumberLimiter && !full ? this.largeNumberFormat(num) : this.numberFormat(num) );
	},

	GetSimpleMovingWeightedAverage: function(data, fname, N, accuracy)
	{
		var n_data = [];
		if (accuracy < 1)
			accuracy = 1;
		accuracy = Math.pow(10, accuracy);
		return data.map(
					function(el)
					{
						var val = el[fname];
						var avg_val = val;

						if (N > 0)
						{
							if (n_data.length == N)
								n_data.shift();
							n_data.push(val);

							// arithmetic mean
//								avg_val = Math.round(n_data.reduce( (sum, val) => sum+val ) / n_data.length * accuracy) / accuracy;
							// weighted arithmetic mean
							var weights_sum = (n_data.length*(n_data.length+1))/2;
							if (weights_sum > 0)
								avg_val = Math.round(n_data.reduce( (sum, val, idx) => sum + (idx+1) * (val > 0 ? val : 0) ) / weights_sum * accuracy) / accuracy;
						}

						return { date:el.date, value:avg_val };
					}
		);
	},

	GetMaxValueFromData: function(data, val_name)
	{
		if (!val_name)
			val_name = "value";
		var values = Object.keys( data ).map( key => data[key][val_name] || 0 );
		return Math.max.apply(null, values);
	},

	GetMinValueFromData: function(data, val_name)
	{
		if (!val_name)
			val_name = "value";
		var values = Object.keys( data ).map( key => data[key][val_name] || 0 );
		return Math.min.apply(null, values);
	},

	FindValueByRegression: function(func, expect_max_value, cur_day_idx, step_days)
	{
		var steps_limiter = 100;
		while (steps_limiter-- > 0)
		{
			cur_day_idx += step_days;
			if (cur_day_idx > 180)
				return null;

			var curr_contag = func(cur_day_idx);
			if (curr_contag <= expect_max_value)
			{
				if ((Math.abs(step_days) <= 1) || (curr_contag == expect_max_value))
				{
					// peak
					return cur_day_idx;
				}

				step_days = Math.round(step_days/2)
				if (step_days > 0)
					step_days = -step_days;
			}
			else
				step_days = Math.abs(step_days);
		}
		return null;
	},

	IsInViewport: function(el)
	{
		var bounding = el.getBoundingClientRect();
		return (
			bounding.top >= 0
			&& bounding.left >= 0
			&& bounding.bottom <= (window.innerHeight || document.documentElement.clientHeight)
			&& bounding.right <= (window.innerWidth || document.documentElement.clientWidth)
		);
	},

	// http://mathprofi.ru/kak_vychislit_opredelitel.html
	GetDeterminantOfMatrix: function(mlines)
	{
		var size = mlines.length;
		if (size == 2)
			return mlines[0][0]*mlines[1][1] - mlines[1][0]*mlines[0][1];

		var submatrix;
		var sum_list = [];
		var i, sign = -1;
		for (i=0; i<size; i++)
		{
			submatrix = [];
			for (var li=1; li<size; li++)
			{
				var line = [];
				for (var ri=0; ri<size; ri++)
					if (ri != i)	// ignore active column
						line.push(mlines[li][ri]);
				submatrix.push(line);
			}

			sign = -sign;
			sum_list.push( sign*mlines[0][i] * this.GetDeterminantOfMatrix(submatrix) );
			
		}
		return sum_list.reduce((sum, d) => sum+d, 0);
	},

	// short method, without row reduce. TODO: check it...
	// http://mathprofi.ru/metod_gaussa_dlya_chainikov.html
	GetUnknownsByGaussMethod: function(matrix)
	{
		// make Triangular matrix
		var transformed = [];
		matrix.forEach((row, idx) => {
			var new_row = row.slice();

			// setup zeros
			var num, prev_row;
			for (var i=0; i<idx; i++)
			{
				prev_row = transformed[i];
				num = -new_row[i];
				new_row = new_row.map((d,j) => prev_row[j]*num + d);
			}

			// setup `1`
			num = new_row[idx];
			new_row = new_row.map(d => d/num);
			transformed.push(new_row);
		});

		// calc unknowns
		var unk_i, unk_cnt = transformed.length;
		var sum_list, unknowns = [];
		transformed.reverse().forEach((row, idx) => {
			// collect sum els (move known els to right)
			sum_list = [row.pop()];
			unknowns.forEach( d => sum_list.push( -d*row.pop() ) );

			// add result of next unknown
			unknowns.push( sum_list.reduce( (sum,d) => sum+d ) );
		});
		return unknowns.reverse();
	},

	// http://mathprofi.ru/metod_naimenshih_kvadratov.html
	GetUnknownsByCramerMethod: function(matrix)
	{
		// | sum_xx | sum_x | sum_xy
		// | sum_x  | n     | sum_y
		var unks_cnt = matrix[0].length-1;
		var sub_matrix = matrix.map(row => row.slice(0, unks_cnt));

		// D = | sum_xx | sum_x |
		//     | sum_x  | n     |
		// D = sum_xx*n - sum_x*sum_x;
		var D = this.GetDeterminantOfMatrix(sub_matrix);
		if (!D)
			return this.GetUnknownsByGaussMethod(matrix);	// try  method of Gauss

		var D_unks = [];
		// Da = | sum_xy | sum_x |
		//      | sum_y  | n     |
		// Db = | sum_xx | sum_xy |
		//      | sum_x  | sum_y  |
		for (var i=0; i<unks_cnt; i++)
		{
			sub_matrix = matrix.map(row => { var new_row = row.slice(); new_row.splice(i, 1, new_row.pop()); return new_row; } );	// less memory and cpu usage
			D_unks.push( this.GetDeterminantOfMatrix(sub_matrix) );
		}

		// a = Da/D
		// b = Db/D
		return D_unks.map(d => d/D);
	},

	GetВeviationsLevelByLeastSquares: function(xy_list, func)
	{
		var sum = 0;
		for (var xy of xy_list)
			sum += Math.pow(xy[1] - func(xy[0]), 2);
		return sum;
	},

	// http://mathprofi.ru/metod_naimenshih_kvadratov.html
	GetLineMethodByLeastSquaresOf: function(xy_list)
	{
		if (!xy_list.length)
			return false;
		// y = ax + b

		// calculate sums
		// | a∑x^2 + b∑x = ∑xy
		// | a∑x + bn = ∑y
		var sum_x = 0;
		var sum_y = 0;
		var sum_xx = 0;
		var sum_xy = 0;
		for (var xy of xy_list)
		{
			sum_x += xy[0];
			sum_y += xy[1];
			sum_xx += xy[0]*xy[0];
			sum_xy += xy[0]*xy[1];
		}

		var n = xy_list.length;

		// | a*sum_xx + b*sum_x = sum_xy
		// | a*sum_x + bn = sum_y
		var unknows = this.GetUnknownsByCramerMethod([
												[sum_xx, sum_x, sum_xy],
												[sum_x,  n,     sum_y]
												]);
		var a = unknows[0];
		var b = unknows[1];
		var func = function(x) { return a*x+b; };

		// check error level
/*
			var var_sum = 0;
			for (var xy of xy_list)
				var_sum += Math.pow(xy[1] - func(xy[0]), 2);

			var delta = n * sum_xx - sum_x * sum_x;
			var vari = 1.0 / (n - 2.0) * var_sum;

			console.log([ Math.sqrt(vari / delta * sum_xx), Math.sqrt(n / delta * vari) ]);
/**/
		//

		var invert_func = function(y) { return (y - b) / a; };	// x = (y - b) / a
		// y = ax + b
		// y - b = ax
		// (y - b) / a = x

		return {
			func:			func,
			invert_func:	invert_func,
			last_learn_day_id: xy_list.slice(-1)[0][0],
			a: a,
			b: b
		};
	},

	// https://www.matburo.ru/ex_ms.php?p1=msmnk
	// https://www.matburo.ru/Examples/Files/ms_mnk_5.pdf
	// http://mathprofi.ru/pravilo_kramera_matrichnyi_metod.html
	GetParabolaMethodByLeastSquaresOf: function(xy_list, invert)
	{
		if (!xy_list.length)
			return false;
		// y = ax^2 + bx + c

		// calculate sums
		// | a∑x^4 + b∑x^3 + c∑x^2 = ∑yx^2
		// | a∑x^3 + b∑x^2 + c∑x = ∑xy
		// | a∑x^2 + b∑x + cn = ∑y
		var sum_x = 0;
		var sum_y = 0;
		var sum_xx = 0;
		var sum_xy = 0;
		var sum_xxxx = 0;
		var sum_xxx = 0;
		var sum_xxy = 0;
		var xx = 0;
		for (var xy of xy_list)
		{
			xx = xy[0]*xy[0];

			sum_x += xy[0];
			sum_y += xy[1];
			sum_xx += xx;
			sum_xy += xy[0]*xy[1];
			sum_xxx += xx*xy[0];
			sum_xxy += xx*xy[1];
			sum_xxxx += xx*xx;
		}

		var n = xy_list.length;
		// | a*sum_xxxx + b*sum_xxx + c*sum_xx = sum_xxy
		// | a*sum_xxx + b*sum_xx + c*sum_x = sum_xy
		// | a*sum_xx + b*sum_x + cn = sum_y
		var unknows = this.GetUnknownsByCramerMethod([
										[sum_xxxx, sum_xxx, sum_xx, sum_xxy],
										[sum_xxx,  sum_xx,  sum_x,  sum_xy],
										[sum_xx,   sum_x,   n,      sum_y]
										]);
		var a = unknows[0];
		var b = unknows[1];
		var c = unknows[2];
		var func = function(x) { return a*x*x + b*x + c; };

		// check error level
		// TODO: recheck for parabola!
/*
			var var_sum = 0;
			for (var xy of xy_list)
				var_sum += Math.pow(xy[1] - func(xy[0]), 2);

			var delta = n * sum_xx - sum_x*sum_x;
			var vari = 1.0 / (n - 2.0) * var_sum;

			console.log([ Math.sqrt(vari / delta * sum_xx), Math.sqrt(n / delta * vari) ]);
/**/
		// TODO:
		// detect increasing or decreasing? (detect x of top? = -(b/2a); y=(4ac-bb)/4a) ( https://scienceland.info/algebra8/quadratic-function )
		// detect where is Y = 1?

//		var invert_func = function(y) { return (Math.sqrt( 4*a*y + b*b - 4*a*c ) - b) / 2*a; };	// x = (√(4ay + bb - 4ac) - b)/2a
		var invert_func = null;		// current invert function can have not answer ( √-1 = NaN )
		// y = axx + bx + c
		// y = a(xx + xb/a) + c
		// y = a(xx + xb/a) + c
		// y = a(xx + 2xb/2a) + c
		// y = a(xx + 2xb/2a + bb/4aa - bb/4aa) + c
		// y = a((xx + 2xb/2a + bb/4aa) - bb/4aa) + c
		// y = a((x + b/2a)^2 - bb/4aa) + c
		// y = a(x + b/2a)^2 - bb/4a + c
		// y = a(x + b/2a)^2 - (bb - 4ac)/4a
		// y + (bb - 4ac)/4a = a(x + b/2a)^2
		// (4ay + bb - 4ac)/4a = a(x + b/2a)^2
		// (4ay + bb - 4ac)/4a * 1/a = (x + b/2a)^2
		// (4ay + bb - 4ac)/4aa = (x + b/2a)^2
		// √((4ay + bb - 4ac)/4aa) = x + b/2a
		// √(4ay + bb - 4ac)/2a = x + b/2a
		// √(4ay + bb - 4ac)/2a - b/2a = x
		// (√(4ay + bb - 4ac) - b)/2a = x

		return {
			func:			func,
			invert_func:	invert_func,
			last_learn_day_id: xy_list.slice(-1)[0][0],
			a: a,
			b: b,
			c: c
		};
	},

	GetBestRegressionMethod: function(xy_list, out_last_n)
	{
		var err, method, methods = [];
		var last_n_xy_list_raw = xy_list.slice(xy_list.length - out_last_n);
		var last_n_xy_list = last_n_xy_list_raw.map((d,idx) => [idx, d[1]]);

		// for line better calculate only output part
		method = this.GetLineMethodByLeastSquaresOf(last_n_xy_list);
		err = this.GetВeviationsLevelByLeastSquares(last_n_xy_list, method.func); 
		methods.push( Object.assign({name:"line", error:err}, method) );

		// for parabola better calculate all data
		method = this.GetParabolaMethodByLeastSquaresOf(xy_list);
		err = this.GetВeviationsLevelByLeastSquares(last_n_xy_list_raw, method.func);	// test only on last period
		methods.push( Object.assign({name:"parabola", error:err}, method) );

		var bets_method = methods.reduce( (best, m) => (!best || best.error > m.error ? m : best ) );
		return bets_method;
	}
};
//export default DataTools;