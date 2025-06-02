import socket

HOST = 'localhost'
PORT = 5000

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect((HOST, PORT))

s.sendall(b"Hello from client!")
data = s.recv(1024)

print(f"Received: {data.decode()}")
s.close()