import time
from node.local_train import train_node
from node.peer import send_weights, start_peer_server
from model.model import Net

# For testing — node 0 sends to node 1
peer_port = 5001

def handle_received_weights(received_state_dict):
    print("✅ Node 1 received model weights!")
    model = Net()
    model.load_state_dict(received_state_dict)
    # Optionally evaluate or re-train
    print("Model successfully loaded at Node 1.")

if __name__ == "__main__":
    # Start peer server for Node 1
    start_peer_server(port=peer_port, callback=handle_received_weights)

    time.sleep(1)  # Wait for server to be ready

    # Node 0 trains and sends weights
    print("🟢 Node 0 training...")
    model_weights = train_node(node_id=0, total_nodes=2)
    send_weights("localhost", peer_port, model_weights)
