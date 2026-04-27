import pandas as pd
from sklearn.preprocessing import LabelEncoder
import joblib
import os

# 1. Read the CSV file
file_path = '/Users/rashinidissanayake/electricity-consumption-forcasting/backend/data/cleaned_data_enriched.csv'
df = pd.read_csv(file_path)

# 2. Extract unique district values
unique_districts = df['district'].unique()
print(f"Unique districts found: {sorted(unique_districts.tolist())}")

# 3. Create and fit LabelEncoder
le = LabelEncoder()
le.fit(unique_districts)

# 4. Save the encoder using joblib
save_path = '/Users/rashinidissanayake/electricity-consumption-forcasting/backend/models/LSTM/le_district.pkl'
os.makedirs(os.path.dirname(save_path), exist_ok=True)
joblib.dump(le, save_path)

if os.path.exists(save_path):
    print(f"SUCCESS: LabelEncoder saved to {save_path}")
else:
    print(f"FAILURE: LabelEncoder not saved.")
