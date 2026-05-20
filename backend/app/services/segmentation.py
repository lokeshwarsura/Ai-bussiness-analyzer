import sqlite3
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import os
from ..db import get_db_connection

def run_customer_segmentation():
    conn = get_db_connection()
    df = pd.read_sql("SELECT * FROM customer_campaign", conn)
    conn.close()
    
    if df.empty:
        return {"error": "No campaign customer data found"}
        
    # Feature Engineering
    # Total Spending
    mnt_cols = ["mntwines", "mntfruits", "mntmeatproducts", "mntfishproducts", "mntsweetproducts", "mntgoldprods"]
    df["total_spending"] = df[mnt_cols].sum(axis=1)
    
    # Purchase Frequency
    pur_cols = ["numwebpurchases", "numcatalogpurchases", "numstorepurchases"]
    df["purchase_frequency"] = df[pur_cols].sum(axis=1)
    
    # Select clustering features
    features = ["income", "total_spending", "purchase_frequency", "recency"]
    X = df[features].copy()
    
    # Impute missing values just in case
    X = X.fillna(X.median())
    
    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Apply K-Means
    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
    df["cluster"] = kmeans.fit_predict(X_scaled)
    
    # Label Clusters based on centroids/means
    cluster_means = df.groupby("cluster")[features].mean()
    
    # Find which cluster has the highest spending (Premium)
    spending_order = cluster_means["total_spending"].sort_values(ascending=False).index.tolist()
    
    cluster_mapping = {
        spending_order[0]: "Premium Customers",
        spending_order[1]: "Loyal / Frequent Buyers",
        spending_order[2]: "Low-Value / At-Risk Customers"
    }
    
    df["segment_name"] = df["cluster"].map(cluster_mapping)
    
    # PCA for 2D Visual Scatter Plot
    pca = PCA(n_components=2)
    X_pca = pca.fit_transform(X_scaled)
    df["pca_x"] = X_pca[:, 0]
    df["pca_y"] = X_pca[:, 1]
    
    # Get statistics for each cluster
    stats = []
    total_customers = len(df)
    total_revenue_est = df["total_spending"].sum()
    
    for cluster_id in range(3):
        cluster_name = cluster_mapping[cluster_id]
        cluster_df = df[df["cluster"] == cluster_id]
        count = len(cluster_df)
        pct = (count / total_customers) * 100
        
        avg_income = float(cluster_df["income"].mean())
        avg_spending = float(cluster_df["total_spending"].mean())
        avg_freq = float(cluster_df["purchase_frequency"].mean())
        avg_recency = float(cluster_df["recency"].mean())
        
        spending_contribution = float((cluster_df["total_spending"].sum() / total_revenue_est) * 100)
        
        stats.append({
            "cluster_id": int(cluster_id),
            "segment_name": cluster_name,
            "count": int(count),
            "percentage": float(pct),
            "avg_income": float(avg_income),
            "avg_spending": float(avg_spending),
            "avg_frequency": float(avg_freq),
            "avg_recency": float(avg_recency),
            "spending_contribution": float(spending_contribution)
        })
        
    # Get a sample for plotting (max 200 points to keep response light and speed high)
    plot_sample = df.sample(n=min(200, len(df)), random_state=42)[["id", "income", "total_spending", "purchase_frequency", "recency", "segment_name", "pca_x", "pca_y"]]
    plot_points = plot_sample.to_dict(orient="records")
    
    return {
        "success": True,
        "segments": stats,
        "plot_data": plot_points,
        "meta": {
            "total_customers": int(total_customers),
            "total_spending": float(total_revenue_est)
        }
    }
