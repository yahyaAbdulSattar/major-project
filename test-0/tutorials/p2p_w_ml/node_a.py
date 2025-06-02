import socket
import threading
import pickle
from sklearn.linear_model import LogisticRegression
import numpy as np

# Local data for Peer A
X_local = np.array([[0, 1], [1, 1], [1, 0]])
y_local = np.array([0, 1, 1])

# Train local model
model = LogisticRegression()
model.fit(X_local, y_local)

local_weights = {
    'weights': model.coef_.tolist(),
    'intercept': model.intercept_.tolist()
}

# Peer B info
TARGET_HOST = 'localhost'
TARGET_PORT = 6001
LISTEN_PORT = 6000

received_weights = None


# Send local weights to Peer B
def send_weights():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((TARGET_HOST, TARGET_PORT))
    s.sendall(pickle.dumps(local_weights))
    s.close()
    print("[Sent] Local weights sent to peer.")


# Listen and receive weights
def listen_for_peer():
    global received_weights
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(('localhost', LISTEN_PORT))
    server.listen()
    print(f"[Listening] on port {LISTEN_PORT}...")

    conn, addr = server.accept()
    data = b""
    while True:
        part = conn.recv(4096)
        if not part:
            break
        data += part
    received_weights = pickle.loads(data)
    print(f"[Received] Weights from peer: {received_weights}")
    conn.close()


# Start listener in background
threading.Thread(target=listen_for_peer, daemon=True).start()

input("Press Enter to send local weights...")
send_weights()

# Wait for data
input("Press Enter once you received peer's weights to aggregate...")

# Aggregate weights
if received_weights:
    avg_weights = (np.array(local_weights['weights']) + np.array(received_weights['weights'])) / 2
    avg_intercept = (np.array(local_weights['intercept']) + np.array(received_weights['intercept'])) / 2
    print("[Result] Global Weights:", avg_weights.tolist())
    print("[Result] Global Intercept:", avg_intercept.tolist())
else:
    print("[Error] No weights received yet.")
