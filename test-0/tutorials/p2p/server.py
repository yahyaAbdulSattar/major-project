import socket

HOST = 'localhost'  # Standard loopback interface address (localhost)
PORT = 5000        # Port to listen on (non-privileged ports are > 1023)

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)  # Create a TCP/IP socket

s.bind((HOST, PORT))  # Bind the socket to the address and port
s.listen(1)  # Listen for incoming connections

print(f"Server started at {HOST}:{PORT}")
conn, addr = s.accept();
print(f"Connected by {addr}")

while True:
    data = conn.recv(1024)  # Receive data from the client
    if not data:
        break  # Break the loop if no data is received
    print(f"Received: {data.decode()}")  # Print the received data
    conn.sendall(data)  # Echo the received data back to the client

conn.close()  # Close the connection
