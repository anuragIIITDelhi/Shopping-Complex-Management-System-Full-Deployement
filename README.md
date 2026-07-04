Shopping-Complex-Management-System-Full-Deployement-

PROJECT STRUCTURE
mkdir public mv index.html public/

Final structure: project/

public/
index.html
shopping_backend.cpp
server.js
package.json
===========================================================

INSTALL DEPENDENCIES (Ubuntu/Kali)
sudo apt update

sudo apt install -y g++ make mariadb-server mariadb-client libmariadb-dev nodejs npm git

===========================================================

INSTALL NODEJS (LATEST VERSION)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - sudo apt install -y nodejs

Check: node -v npm -v

===========================================================

START MARIADB
sudo systemctl start mariadb sudo systemctl enable mariadb

Login: sudo mysql

===========================================================

CREATE DATABASE
CREATE DATABASE shopping_db;

CREATE USER 'shopping_user'@'localhost' IDENTIFIED BY '1234';

GRANT ALL PRIVILEGES ON shopping_db.* TO 'shopping_user'@'localhost';

FLUSH PRIVILEGES;

EXIT;

===========================================================

CREATE TABLES
mysql -u shopping_user -p1234 shopping_db

TABLES:

Products: CREATE TABLE IF NOT EXISTS products ( code INT PRIMARY KEY, name VARCHAR(100), price DECIMAL(10,2), discount DECIMAL(5,2) DEFAULT 0.00, image_url VARCHAR(255) );

Users: CREATE TABLE IF NOT EXISTS users ( id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(100), email VARCHAR(100) UNIQUE, phone VARCHAR(15), password VARCHAR(255), role ENUM('admin','buyer') DEFAULT 'buyer', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP );

OTP: CREATE TABLE IF NOT EXISTS otp_verification ( id INT PRIMARY KEY AUTO_INCREMENT, phone VARCHAR(15), otp_code VARCHAR(6), is_verified BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, expires_at TIMESTAMP );

Orders: CREATE TABLE IF NOT EXISTS orders ( id INT PRIMARY KEY AUTO_INCREMENT, user_id INT, user_name VARCHAR(100), user_email VARCHAR(100), items TEXT, total DECIMAL(10,2), order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP );

EXIT;

===========================================================

COMPILE C++ BACKEND
g++ -o shopping_backend shopping_backend.cpp -I/usr/include/mariadb -lmariadb

===========================================================

RUN NODE SERVER
node server.js

===========================================================

NGROK SETUP
ngrok authtoken YOUR_TOKEN_HERE

ngrok http 3000

===========================================================

DONE Your project will now be accessible globally via ngrok link
