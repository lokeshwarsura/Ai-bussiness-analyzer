import sqlite3
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel
import os
from ..db import get_db_connection

def search_products(query, limit=10):
    conn = get_db_connection()
    df = pd.read_sql("SELECT product_id, product_name, category, discounted_price, actual_price, rating, img_link FROM amazon_products", conn)
    conn.close()
    
    if df.empty:
        return []
        
    # Simple substring search
    matched = df[df["product_name"].str.lower().str.contains(query.lower()) | df["category"].str.lower().str.contains(query.lower())]
    if matched.empty:
        # Return fallback high rating products
        matched = df.sort_values(by="rating", ascending=False).head(limit)
        
    return matched.head(limit).to_dict(orient="records")

def get_product_recommendations(product_id):
    conn = get_db_connection()
    # Read core columns for tf-idf
    df = pd.read_sql("SELECT product_id, product_name, category, discounted_price, actual_price, rating, img_link, about_product FROM amazon_products", conn)
    conn.close()
    
    if df.empty:
        return {"error": "Amazon catalog empty"}
        
    # Check if target product exists
    target_idx_list = df[df["product_id"] == product_id].index.tolist()
    if not target_idx_list:
        return {"success": False, "error": f"Product '{product_id}' not found."}
    
    target_idx = target_idx_list[0]
    
    # Fill NA about_product
    df["about_product"] = df["about_product"].fillna("")
    df["category"] = df["category"].fillna("")
    df["product_name"] = df["product_name"].fillna("")
    
    # Combined textual description
    df["text"] = df["product_name"] + " " + df["category"] + " " + df["about_product"]
    
    # Vectorize and compute similarity online
    # Using max_features=1000 to keep it extremely fast and lightweight
    tfidf = TfidfVectorizer(stop_words="english", max_features=1000)
    tfidf_matrix = tfidf.fit_transform(df["text"])
    
    # Calculate similarity for the target product only (highly efficient)
    target_vector = tfidf_matrix[target_idx]
    cosine_sim = linear_kernel(target_vector, tfidf_matrix).flatten()
    
    # Sort and get top similar indices
    similar_indices = cosine_sim.argsort()[::-1]
    
    # Exclude itself
    similar_indices = [idx for idx in similar_indices if idx != target_idx]
    
    recs = []
    # Take top 5 recommendations
    for idx in similar_indices[:5]:
        row = df.iloc[idx]
        recs.append({
            "product_id": row["product_id"],
            "product_name": row["product_name"],
            "category": row["category"],
            "discounted_price": float(row["discounted_price"]),
            "actual_price": float(row["actual_price"]),
            "rating": float(row["rating"]),
            "img_link": row["img_link"],
            "similarity_score": float(cosine_sim[idx])
        })
        
    target_prod = df.iloc[target_idx]
    
    return {
        "success": True,
        "target_product": {
            "product_id": target_prod["product_id"],
            "product_name": target_prod["product_name"],
            "category": target_prod["category"],
            "discounted_price": float(target_prod["discounted_price"]),
            "actual_price": float(target_prod["actual_price"]),
            "rating": float(target_prod["rating"]),
            "img_link": target_prod["img_link"]
        },
        "recommendations": recs
    }
