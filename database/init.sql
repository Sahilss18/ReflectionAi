CREATE DATABASE IF NOT EXISTS presentation_simulator;
USE presentation_simulator;

-- Store users (optional for now, but good practice for schema)
CREATE TABLE IF NOT EXISTS Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store sessions
CREATE TABLE IF NOT EXISTS Sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    title VARCHAR(255) NOT NULL,
    scenario_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- Store uploaded context files
CREATE TABLE IF NOT EXISTS UploadedContexts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES Sessions(id) ON DELETE CASCADE
);

-- Store chat logs/transcript
CREATE TABLE IF NOT EXISTS ChatLogs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    speaker_role VARCHAR(100) NOT NULL, -- e.g., 'User', 'Skeptical VC', 'Tech Lead'
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES Sessions(id) ON DELETE CASCADE
);

-- Store analytics
CREATE TABLE IF NOT EXISTS FeedbackAnalytics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    context_accuracy_score DECIMAL(5,2),
    wpm INT,
    filler_word_count INT,
    feedback_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES Sessions(id) ON DELETE CASCADE
);
