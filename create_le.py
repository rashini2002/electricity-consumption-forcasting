import joblib
from sklearn.preprocessing import LabelEncoder
import os

districts = ['Colombo', 'Galle', 'Gampaha', 'Kalutara', 'Matara', 'Kandy', 'Nuwara Eliya', 'Batticaloa', 'Ampara', 'Anuradhapura', 'Kurunegala', 'Kegalle', 'Polonnaruwa', 'Badulla', 'Jaffna', 'Mullaitivu', 'Kilinochchi', 'Vavuniya', 'Mannar', 'Puttalam', 'Ratnapura', 'Monaragala']

le = LabelEncoder()
le.fit(districts)

path = '/Users/rashinidissanayake/electricity-consumption-forcasting/backend/models/LSTM/le_district.pkl'
joblib.dump(le, path)

if os.path.exists(path):
    print(f"SUCCESS: {path} created.")
else:
    print(f"FAILURE: {path} not created.")
