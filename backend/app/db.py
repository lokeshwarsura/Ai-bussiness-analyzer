import sqlite3
import pandas as pd
import numpy as np
import os
import glob

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "platform.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def clean_column_names(df):
    df.columns = [c.strip().lower().replace(" ", "_").replace("-", "_") for c in df.columns]
    return df

def seed_database():
    print("Starting data preprocessing and database seeding...")
    
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    print("Workspace directory resolved successfully.")
    
    # 1. Superstore Sales Data
    superstore_path = os.path.join(workspace_dir, "superstore", "SampleSuperstore.csv")
    if os.path.exists(superstore_path):
        print("Preprocessing SampleSuperstore...")
        try:
            df = pd.read_csv(superstore_path)
            df = clean_column_names(df)
            # Seed to sqlite
            conn = get_db_connection()
            df.to_sql("superstore", conn, if_exists="replace", index=False)
            conn.close()
            print("Successfully seeded 'superstore' table.")
        except Exception as e:
            print(f"Error seeding superstore: {e}")
    else:
        print("Superstore CSV file not found.")

    # 2. Customer Marketing Campaign Data (Tab-separated)
    campaign_path = os.path.join(workspace_dir, "customer", "marketing_campaign.csv")
    if os.path.exists(campaign_path):
        print("Preprocessing Customer Marketing Campaign...")
        try:
            df = pd.read_csv(campaign_path, sep="\t")
            df = clean_column_names(df)
            # Impute missing income
            if "income" in df.columns:
                df["income"] = df["income"].fillna(df["income"].median())
            
            conn = get_db_connection()
            df.to_sql("customer_campaign", conn, if_exists="replace", index=False)
            conn.close()
            print("Successfully seeded 'customer_campaign' table.")
        except Exception as e:
            print(f"Error seeding customer campaign: {e}")
    else:
        print("Marketing campaign CSV file not found.")

    # 3. Telco Customer Churn Data
    churn_path = os.path.join(workspace_dir, "telecom", "WA_Fn-UseC_-Telco-Customer-Churn.csv")
    if os.path.exists(churn_path):
        print("Preprocessing Telecom Churn Data...")
        try:
            df = pd.read_csv(churn_path)
            df = clean_column_names(df)
            
            # Clean total_charges (has empty string spaces)
            if "totalcharges" in df.columns:
                df["totalcharges"] = pd.to_numeric(df["totalcharges"].astype(str).str.strip(), errors="coerce")
                df["totalcharges"] = df["totalcharges"].fillna(0.0)
                
            conn = get_db_connection()
            df.to_sql("churn_data", conn, if_exists="replace", index=False)
            conn.close()
            print("Successfully seeded 'churn_data' table.")
        except Exception as e:
            print(f"Error seeding churn data: {e}")
    else:
        print("Churn CSV file not found.")

    # 4. Walmart Sales Data (Forecasting)
    walmart_path = os.path.join(workspace_dir, "walmart", "train.csv")
    if os.path.exists(walmart_path):
        print("Preprocessing Walmart Sales Data...")
        try:
            df = pd.read_csv(walmart_path)
            df = clean_column_names(df)
            
            conn = get_db_connection()
            df.to_sql("walmart_sales", conn, if_exists="replace", index=False)
            conn.close()
            print("Successfully seeded 'walmart_sales' table.")
        except Exception as e:
            print(f"Error seeding walmart sales: {e}")
    else:
        print("Walmart train CSV file not found.")

    # 5. Social Media Advertising (Campaign ROI)
    social_path = os.path.join(workspace_dir, "social media", "Social_Media_Advertising.csv")
    if os.path.exists(social_path):
        print("Preprocessing Social Media Campaign Data...")
        try:
            df = pd.read_csv(social_path)
            df = clean_column_names(df)
            
            # Clean acquisition_cost (remove '$')
            if "acquisition_cost" in df.columns:
                df["acquisition_cost"] = df["acquisition_cost"].astype(str).str.replace("$", "", regex=False).str.replace(",", "", regex=False)
                df["acquisition_cost"] = pd.to_numeric(df["acquisition_cost"], errors="coerce").fillna(0.0)
                
            conn = get_db_connection()
            df.to_sql("social_campaigns", conn, if_exists="replace", index=False)
            conn.close()
            print("Successfully seeded 'social_campaigns' table.")
        except Exception as e:
            print(f"Error seeding social campaigns: {e}")
    else:
        print("Social media advertising CSV file not found.")

    # 6. Amazon Products (Reviews & Recommendations)
    amazon_path = os.path.join(workspace_dir, "amazon", "amazon.csv")
    if os.path.exists(amazon_path):
        print("Preprocessing Amazon Products Data...")
        try:
            # Using encoding='utf-8' to prevent charmap errors on Windows
            df = pd.read_csv(amazon_path, encoding="utf-8")
            df = clean_column_names(df)
            
            # Clean discounted_price and actual_price (remove Rupee symbol \u20b9, commas, etc.)
            for col in ["discounted_price", "actual_price"]:
                if col in df.columns:
                    df[col] = df[col].astype(str).str.replace("₹", "", regex=False)
                    df[col] = df[col].str.replace(",", "", regex=False).str.strip()
                    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
            
            # Clean rating (has some invalid strings like '|')
            if "rating" in df.columns:
                df["rating"] = pd.to_numeric(df["rating"].astype(str).str.strip(), errors="coerce").fillna(4.0)
            if "rating_count" in df.columns:
                df["rating_count"] = df["rating_count"].astype(str).str.replace(",", "", regex=False)
                df["rating_count"] = pd.to_numeric(df["rating_count"], errors="coerce").fillna(0.0)
                
            conn = get_db_connection()
            df.to_sql("amazon_products", conn, if_exists="replace", index=False)
            conn.close()
            print("Successfully seeded 'amazon_products' table.")
        except Exception as e:
            print(f"Error seeding amazon products: {e}")
    else:
        print("Amazon products CSV file not found.")

    print("Database seeding completed.")

if __name__ == "__main__":
    seed_database()
