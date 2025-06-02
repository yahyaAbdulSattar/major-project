from sklearn.linear_model import LogisticRegression
import numpy as np

def train_local_model(X, y):
    model = LogisticRegression()
    model.fit(X, y)
    weights = model.coef_.tolist()
    intercept = model.intercept_.tolist()
    return weights, intercept