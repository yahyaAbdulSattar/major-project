import json
from sklearn.linear_model import LinearRegression
import numpy as np

# Sample dummy data
X = np.array([[1, 1], [1, 2], [2, 2], [2, 3]])
y = np.dot(X, np.array([1, 2])) + 3

model = LinearRegression().fit(X, y)

weights = {
    'weights': model.coef_.tolist(),
    'intercept': model.intercept_.tolist() if hasattr(model.intercept_, 'tolist') else model.intercept_
}

# Save to file
with open("data/weights.json", "w") as f:
    json.dump(weights, f)

print("[Python] Model trained and weights saved.")
