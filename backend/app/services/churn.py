import sqlite3
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import os
from ..db import get_db_connection

# Global model cache to prevent re-training on every API request
_churn_model = None
_churn_features = None
_scaler_info = None
_encoded_cols = None

def train_churn_model():
    global _churn_model, _churn_features, _encoded_cols
    
    conn = get_db_connection()
    df = pd.read_sql("SELECT * FROM churn_data", conn)
    conn.close()
    
    if df.empty:
        return None, None
        
    # Standardize types
    df["churn_label"] = df["churn"].apply(lambda x: 1 if str(x).strip().lower() == "yes" else 0)
    
    # Drop irrelevant columns
    X_raw = df.drop(columns=["customerid", "churn", "churn_label"], errors="ignore")
    y = df["churn_label"]
    
    # Categorical Columns to encode
    cat_cols = X_raw.select_dtypes(include=["object"]).columns.tolist()
    num_cols = X_raw.select_dtypes(include=[np.number]).columns.tolist()
    
    # Fill missing values
    for col in num_cols:
        X_raw[col] = X_raw[col].fillna(X_raw[col].median())
    for col in cat_cols:
        X_raw[col] = X_raw[col].fillna("Unknown")
        
    # Get Dummies for Categoricals
    X_encoded = pd.get_dummies(X_raw, columns=cat_cols, drop_first=True)
    _encoded_cols = X_encoded.columns.tolist()
    
    # Train Random Forest
    rf = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
    rf.fit(X_encoded, y)
    
    _churn_model = rf
    _churn_features = X_encoded
    
    # Print importance summary
    importances = rf.feature_importances_
    feature_imp = sorted(zip(X_encoded.columns, importances), key=lambda x: x[1], reverse=True)
    
    return rf, feature_imp

def get_churn_insights():
    global _churn_model, _churn_features, _encoded_cols
    
    if _churn_model is None:
        model, feat_imp = train_churn_model()
        if model is None:
            return {"error": "Churn data not seeded"}
    else:
        importances = _churn_model.feature_importances_
        feat_imp = sorted(zip(_encoded_cols, importances), key=lambda x: x[1], reverse=True)
        
    # Get churn base stats
    conn = get_db_connection()
    df = pd.read_sql("SELECT * FROM churn_data", conn)
    conn.close()
    
    total_customers = len(df)
    churn_count = len(df[df["churn"].str.lower() == "yes"])
    base_churn_rate = (churn_count / total_customers) * 100
    
    # Encode current records to get churn probabilities
    cat_cols = df.drop(columns=["customerid", "churn"], errors="ignore").select_dtypes(include=["object"]).columns.tolist()
    num_cols = df.drop(columns=["customerid", "churn"], errors="ignore").select_dtypes(include=[np.number]).columns.tolist()
    
    X_raw = df.drop(columns=["customerid", "churn"], errors="ignore")
    X_encoded = pd.get_dummies(X_raw, columns=cat_cols, drop_first=True)
    
    # Reindex to match trained features
    X_encoded = X_encoded.reindex(columns=_encoded_cols, fill_value=0)
    
    probs = _churn_model.predict_proba(X_encoded)[:, 1]
    df["churn_probability"] = probs
    
    # Get top 15 highest churn risk customers
    high_risk_df = df.sort_values(by="churn_probability", ascending=False).head(15)
    high_risk_list = []
    
    for _, row in high_risk_df.iterrows():
        high_risk_list.append({
            "customer_id": row["customerid"],
            "gender": row["gender"],
            "tenure": int(row["tenure"]),
            "contract": row["contract"],
            "monthly_charges": float(row["monthlycharges"]),
            "total_charges": float(row["totalcharges"]),
            "internet_service": row["internetservice"],
            "churn_probability": float(row["churn_probability"])
        })
        
    # Feature importances formatted
    top_importances = [{"feature": f, "importance": float(i)} for f, i in feat_imp[:8]]
    
    return {
        "success": True,
        "base_churn_rate": float(base_churn_rate),
        "total_customers": int(total_customers),
        "high_risk_customers": high_risk_list,
        "top_features": top_importances
    }

def predict_single_customer(customer_id):
    global _churn_model, _encoded_cols
    
    if _churn_model is None:
        train_churn_model()
        
    conn = get_db_connection()
    df = pd.read_sql("SELECT * FROM churn_data WHERE customerid = ?", conn, params=(customer_id,))
    conn.close()
    
    if df.empty:
        return {"success": False, "error": f"Customer ID '{customer_id}' not found."}
        
    row_data = df.iloc[0]
    
    # Extract features matching the model columns
    conn = get_db_connection()
    full_df = pd.read_sql("SELECT * FROM churn_data", conn)
    conn.close()
    
    # Preprocess
    cat_cols = full_df.drop(columns=["customerid", "churn"], errors="ignore").select_dtypes(include=["object"]).columns.tolist()
    X_raw = full_df.drop(columns=["customerid", "churn"], errors="ignore")
    X_encoded = pd.get_dummies(X_raw, columns=cat_cols, drop_first=True)
    
    # Get index of this customer
    cust_idx = full_df[full_df["customerid"] == customer_id].index[0]
    cust_vector = X_encoded.iloc[[cust_idx]].reindex(columns=_encoded_cols, fill_value=0)
    
    prob = float(_churn_model.predict_proba(cust_vector)[0, 1])
    
    # Tailor retention suggestions based on customer values
    recommendations = []
    
    # Suggest contract conversion
    if str(row_data["contract"]).strip().lower() == "month-to-month":
        recommendations.append(
            "Convert to a 1-Year Contract: Offering a monthly discount of 15% on a 1-year commitment will reduce churn probability by approximately 45%."
        )
    
    # Suggest Online Services
    if str(row_data["onlinesecurity"]).strip().lower() == "no":
        recommendations.append(
            "Free Security Trial: Bundle 'Online Security' free for 3 months to boost product attachment."
        )
        
    if str(row_data["techsupport"]).strip().lower() == "no":
        recommendations.append(
            "Priority Support offer: Enroll in Premium Tech Support with a waiver of the first-time setup fee."
        )
        
    # High bill issues
    if float(row_data["monthlycharges"]) > 75.0:
        recommendations.append(
            "Loyalty Bundle Plan: Match their monthly charges with a new bundled high-speed fiber package offering value-add streaming discounts."
        )
        
    if len(recommendations) == 0:
        recommendations.append("Standard loyalty retention check-in call: Customer is low-risk. Verify satisfaction with their current services.")
        
    return {
        "success": True,
        "customer_id": customer_id,
        "details": {
            "gender": row_data["gender"],
            "senior_citizen": int(row_data["seniorcitizen"]),
            "partner": row_data["partner"],
            "dependents": row_data["dependents"],
            "tenure_months": int(row_data["tenure"]),
            "phone_service": row_data["phoneservice"],
            "internet_service": row_data["internetservice"],
            "contract": row_data["contract"],
            "monthly_charges": float(row_data["monthlycharges"]),
            "total_charges": float(row_data["totalcharges"]),
        },
        "churn_probability": prob,
        "risk_level": "High" if prob > 0.6 else "Medium" if prob > 0.3 else "Low",
        "retention_actions": recommendations
    }
