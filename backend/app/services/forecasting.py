import sqlite3
import pandas as pd
import numpy as np
from statsmodels.tsa.arima.model import ARIMA
import os
from ..db import get_db_connection

def run_sales_forecasting():
    conn = get_db_connection()
    df = pd.read_sql("SELECT date, weekly_sales FROM walmart_sales", conn)
    conn.close()
    
    if df.empty:
        return {"error": "No sales data found for forecasting"}
        
    # Preprocess date
    df["date"] = pd.to_datetime(df["date"])
    
    # Aggregate weekly sales by date
    weekly_df = df.groupby("date")["weekly_sales"].sum().reset_index()
    weekly_df = weekly_df.sort_values("date").reset_index(drop=True)
    
    if len(weekly_df) < 10:
        return {"error": "Insufficient sales data points (minimum 10 required)"}
        
    # Fit ARIMA model
    # We will use simple (1, 1, 1) or (2, 1, 1) order which is robust, fast, and handles trend nicely
    try:
        # Convert date to index with freq
        ts_data = weekly_df.set_index("date")["weekly_sales"]
        ts_data = ts_data.asfreq("W-FRI", method="pad") # Walmart sales date is usually Friday
        
        # Fit model
        model = ARIMA(ts_data, order=(1, 1, 1))
        model_fit = model.fit()
        
        # Forecast 12 weeks ahead
        forecast_steps = 12
        forecast_res = model_fit.get_forecast(steps=forecast_steps)
        forecast_mean = forecast_res.predicted_mean
        conf_int = forecast_res.conf_int(alpha=0.05) # 95% confidence interval
        
        # Create forecast dates
        last_date = ts_data.index[-1]
        forecast_dates = pd.date_range(start=last_date + pd.Timedelta(weeks=1), periods=forecast_steps, freq="W-FRI")
        
        forecast_list = []
        for idx, date in enumerate(forecast_dates):
            date_str = date.strftime("%Y-%m-%d")
            pred = float(forecast_mean.iloc[idx])
            lower = float(conf_int.iloc[idx, 0])
            upper = float(conf_int.iloc[idx, 1])
            
            # Bound lower to 0
            lower = max(0.0, lower)
            
            forecast_list.append({
                "date": date_str,
                "sales": pred,
                "lower": lower,
                "upper": upper,
                "is_forecast": True
            })
            
    except Exception as e:
        print(f"ARIMA fit exception: {e}, falling back to robust moving-average trend projection...")
        # Robust linear trend + moving average fallback
        forecast_steps = 12
        last_date = weekly_df["date"].max()
        forecast_dates = pd.date_range(start=last_date + pd.Timedelta(weeks=1), periods=forecast_steps, freq="7D")
        
        # Get last 4-week average and overall growth rate
        last_4_avg = weekly_df["weekly_sales"].tail(4).mean()
        overall_std = weekly_df["weekly_sales"].std()
        
        # Fit a simple linear trend line
        x = np.arange(len(weekly_df))
        y = weekly_df["weekly_sales"].values
        slope, intercept = np.polyfit(x, y, 1)
        
        forecast_list = []
        for idx, date in enumerate(forecast_dates):
            # Project using linear trend plus slight noise
            proj_sales = float(intercept + slope * (len(weekly_df) + idx))
            # Smooth out with recent average
            pred = float(0.7 * proj_sales + 0.3 * last_4_avg)
            pred = max(0.0, pred)
            
            lower = max(0.0, pred - 1.96 * overall_std * (1 + idx * 0.15))
            upper = pred + 1.96 * overall_std * (1 + idx * 0.15)
            
            forecast_list.append({
                "date": date.strftime("%Y-%m-%d"),
                "sales": pred,
                "lower": lower,
                "upper": upper,
                "is_forecast": True
            })
            
    # Format historical records (last 26 weeks)
    history_list = []
    hist_sample = weekly_df.tail(26)
    for _, row in hist_sample.iterrows():
        history_list.append({
            "date": row["date"].strftime("%Y-%m-%d"),
            "sales": float(row["weekly_sales"]),
            "lower": float(row["weekly_sales"]),
            "upper": float(row["weekly_sales"]),
            "is_forecast": False
        })
        
    # Insights
    total_hist_sales = weekly_df["weekly_sales"].sum()
    avg_weekly_hist = weekly_df["weekly_sales"].mean()
    total_fc_sales = sum([f["sales"] for f in forecast_list])
    
    growth_rate = ((total_fc_sales / 12) - avg_weekly_hist) / avg_weekly_hist * 100
    
    return {
        "success": True,
        "forecast": forecast_list,
        "history": history_list,
        "insights": {
            "historical_average": float(avg_weekly_hist),
            "forecasted_average": float(total_fc_sales / 12),
            "predicted_growth_percentage": float(growth_rate),
            "trend": "Upward" if growth_rate > 0 else "Downward",
            "message": f"Sales are projected to {'increase' if growth_rate > 0 else 'decrease'} by {abs(growth_rate):.2f}% over the next 12 weeks."
        }
    }
