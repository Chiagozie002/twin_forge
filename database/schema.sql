CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(160) NOT NULL,
  subject VARCHAR(160) NOT NULL, message TEXT NOT NULL, is_read TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME NOT NULL, ip_hash CHAR(64) NULL, INDEX (ip_hash, created_at)
) CHARACTER SET utf8mb4;
CREATE TABLE projects (
  id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, category VARCHAR(60) NOT NULL,
  short_description VARCHAR(240) NOT NULL, description TEXT NOT NULL, technologies JSON NULL,
  image_url VARCHAR(500) NULL, live_url VARCHAR(500) NULL, github_url VARCHAR(500) NULL,
  status ENUM('active','trashed') NOT NULL DEFAULT 'active', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (status, category)
) CHARACTER SET utf8mb4;
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL, role_title VARCHAR(80) NULL, picture_url VARCHAR(500) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4;
-- Create a founder account (no public sign-up). Generate the hash with:  php -r "echo password_hash('YourStrongPassword', PASSWORD_DEFAULT);"
-- INSERT INTO users (name, email, password_hash, role_title) VALUES ('Founder Name', 'founder@example.com', '<paste hash>', 'Co-Founder');

CREATE TABLE settings (k VARCHAR(60) PRIMARY KEY, v TEXT NOT NULL) CHARACTER SET utf8mb4;   -- about, mission, vision, bio_1, bio_2, social_linkedin ...

-- Password recovery (ajax/auth/*): a code is stored only as a hash and works once; the reset token likewise.
CREATE TABLE password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, otp_hash VARCHAR(255) NOT NULL, token_hash CHAR(64) NULL,
  attempts TINYINT NOT NULL DEFAULT 0, expires_at DATETIME NOT NULL, token_expires_at DATETIME NULL, used_at DATETIME NULL, created_at DATETIME NOT NULL,
  INDEX (user_id), INDEX (token_hash), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4;
-- Counts requests per IP / email so the recovery endpoints can limit abuse.
CREATE TABLE rate_limits (id INT AUTO_INCREMENT PRIMARY KEY, bucket VARCHAR(100) NOT NULL, created_at DATETIME NOT NULL, INDEX (bucket, created_at)) CHARACTER SET utf8mb4;
