CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(160) NOT NULL,
  subject VARCHAR(160) NOT NULL, message TEXT NOT NULL, is_read TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME NOT NULL
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

-- TODO (password recovery, not used yet):
-- CREATE TABLE password_resets (
--   id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, otp_hash VARCHAR(255) NOT NULL, token_hash VARCHAR(255) NULL,
--   attempts TINYINT NOT NULL DEFAULT 0, expires_at DATETIME NOT NULL, used_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   INDEX (user_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- ) CHARACTER SET utf8mb4;
