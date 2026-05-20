import sqlite3
import pandas as pd
import numpy as np
from textblob import TextBlob
import re
import os
from ..db import get_db_connection

# Simple custom stopword list to avoid external NLTK downloads which can block on restricted firewalls
STOPWORDS = {
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", "yourself", "yourselves",
    "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself", "they", "them", "their",
    "theirs", "themselves", "what", "which", "who", "whom", "this", "that", "these", "those", "am", "is", "are",
    "was", "were", "be", "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "a", "an",
    "the", "and", "but", "if", "or", "because", "as", "until", "while", "of", "at", "by", "for", "with", "about",
    "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from", "up",
    "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when",
    "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor",
    "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should",
    "now", "product", "cable", "good", "quality", "working", "use", "one", "like", "get", "would", "also", "buy"
}

def extract_keywords(texts, limit=10):
    word_counts = {}
    for text in texts:
        if not isinstance(text, str):
            continue
        # Lowercase and clean punctuation
        words = re.findall(r"\b[a-z]{3,15}\b", text.lower())
        for w in words:
            if w not in STOPWORDS:
                word_counts[w] = word_counts.get(w, 0) + 1
    sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
    return [{"word": w, "count": c} for w, c in sorted_words[:limit]]

def run_sentiment_analysis():
    conn = get_db_connection()
    # Read subset to make TextBlob analysis extremely fast (last 500 reviews)
    df = pd.read_sql("SELECT product_id, product_name, category, rating, review_title, review_content FROM amazon_products ORDER BY rating_count DESC LIMIT 500", conn)
    conn.close()
    
    if df.empty:
        return {"error": "No reviews found for sentiment analysis"}
        
    df["review_content"] = df["review_content"].fillna("")
    df["review_title"] = df["review_title"].fillna("")
    
    # Calculate Polarity
    polarities = []
    sentiments = []
    
    for review in df["review_content"]:
        if not review.strip():
            polarities.append(0.0)
            sentiments.append("Neutral")
            continue
            
        pol = TextBlob(review).sentiment.polarity
        polarities.append(pol)
        
        if pol > 0.15:
            sentiments.append("Positive")
        elif pol < -0.15:
            sentiments.append("Negative")
        else:
            sentiments.append("Neutral")
            
    df["polarity"] = polarities
    df["sentiment"] = sentiments
    
    # Sentiment distribution
    total_reviews = len(df)
    pos_df = df[df["sentiment"] == "Positive"]
    neu_df = df[df["sentiment"] == "Neutral"]
    neg_df = df[df["sentiment"] == "Negative"]
    
    pos_pct = (len(pos_df) / total_reviews) * 100
    neu_pct = (len(neu_df) / total_reviews) * 100
    neg_pct = (len(neg_df) / total_reviews) * 100
    
    # Extract keywords/complaints
    positive_keywords = extract_keywords(pos_df["review_content"].tolist(), 10)
    negative_keywords = extract_keywords(neg_df["review_content"].tolist(), 10)
    
    # Get high-rated category sentiment stats
    # Group by category (first part of split)
    df["main_category"] = df["category"].fillna("Other").apply(lambda x: str(x).split("|")[0] if "|" in str(x) else str(x))
    cat_groups = df.groupby("main_category")
    
    category_sentiments = []
    for name, group in cat_groups:
        pos_c = len(group[group["sentiment"] == "Positive"])
        neg_c = len(group[group["sentiment"] == "Negative"])
        total_c = len(group)
        
        category_sentiments.append({
            "category": name,
            "total_reviews": total_c,
            "positive_percentage": float((pos_c / total_c) * 100),
            "negative_percentage": float((neg_c / total_c) * 100),
            "avg_rating": float(group["rating"].mean())
        })
        
    category_sentiments = sorted(category_sentiments, key=lambda x: x["total_reviews"], reverse=True)[:5]
    
    # Get dynamic complaints trends list
    complaints = []
    for idx, row in neg_df.head(5).iterrows():
        complaints.append({
            "product_name": row["product_name"][:60] + "...",
            "rating": float(row["rating"]),
            "title": row["review_title"],
            "snippet": row["review_content"][:120] + "..."
        })
        
    return {
        "success": True,
        "sentiment_distribution": {
            "positive": float(pos_pct),
            "neutral": float(neu_pct),
            "negative": float(neg_pct),
            "counts": {
                "positive": int(len(pos_df)),
                "neutral": int(len(neu_df)),
                "negative": int(len(neg_df))
            }
        },
        "positive_keywords": positive_keywords,
        "negative_keywords": negative_keywords,
        "category_sentiments": category_sentiments,
        "complaints_feed": complaints
    }
