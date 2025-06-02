import socket
import threading

HOST = 'localhost'
PORT = 5021

def listen():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind((HOST, PORT))
    server.listen()
    print("Listening for peers...")

    while True:
        conn, addr = server.accept()
        print(f"Connected by {addr}")
        threading.Thread(target=handle_connection, args=(conn,)).start()


def handle_connection(conn):
    while True:
        data = conn.recv(1024)
        if not data:
            break
        print(f"Received: {data.decode()}")
        conn.sendall(b"ACK")
    conn.close()


import socket
import threading

HOST = 'localhost'          # your own address
LISTEN_PORT = 5022          # your listening port
PEER_PORT = 5021            # port of the other peer you want to connect to


# Handles incoming connections (server-side)
def handle_connection(conn):
    while True:
        try:
            data = conn.recv(1024)
            if not data:
                break
            print(f"\n[Peer]: {data.decode()}")
        except:
            break
    conn.close()


# Thread that keeps listening for incoming connections
def listen():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind((HOST, LISTEN_PORT))
    server.listen()
    print(f"[Listening] on port {LISTEN_PORT}...")

    while True:
        conn, addr = server.accept()
        threading.Thread(target=handle_connection, args=(conn,), daemon=True).start()


# Sends a message to the other peer
def send_message():
    while True:
        msg = input()
        try:
            client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            client.connect((HOST, PEER_PORT))
            client.sendall(msg.encode())
            client.close()
        except ConnectionRefusedError:
            print(f"[Error] Peer at port {PEER_PORT} is not available.")


# Start listener in a background thread
threading.Thread(target=listen, daemon=True).start()

# Start the message sending loop in the main thread
print(f"Type a message to send to peer on port {PEER_PORT}:")
send_message()
