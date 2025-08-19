#!/usr/bin/env python3
"""
Extract user logs from SQLite database and organize them by task number.

Usage:
    python3 get_full_json_logs.py <user_id> [--db path/to/database.db]
    
Example:
    python3 get_full_json_logs.py P1
    python3 get_full_json_logs.py P2 --db ./mydata.db
"""

import sqlite3
import json
import sys
import argparse
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Any


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Extract user logs and organize by task number'
    )
    parser.add_argument(
        'user_id',
        help='User ID to extract logs for (e.g., P1, P2)'
    )
    parser.add_argument(
        '--db',
        default='database.db',
        help='Path to SQLite database (default: database.db)'
    )
    parser.add_argument(
        '--output-dir',
        default='user_logs',
        help='Directory to save output JSON files (default: user_logs directory)'
    )
    parser.add_argument(
        '--pretty',
        action='store_true',
        help='Pretty print JSON output'
    )
    return parser.parse_args()


def get_user_logs(db_path: str, user_id: str) -> List[Dict[str, Any]]:
    """
    Fetch all logs for a specific user from the database.
    
    Args:
        db_path: Path to SQLite database
        user_id: User ID to fetch logs for
        
    Returns:
        List of log entries with parsed event_data
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT 
                id,
                user_id,
                timestamp,
                message,
                event_data,
                created_at
            FROM user_logs
            WHERE user_id = ?
            ORDER BY timestamp ASC
        """, (user_id,))
        
        logs = []
        for row in cursor.fetchall():
            log_entry = dict(row)
            
            # Parse the event_data JSON string
            try:
                log_entry['event_data'] = json.loads(log_entry['event_data'])
            except json.JSONDecodeError as e:
                print(f"Warning: Could not parse event_data for log id {log_entry['id']}: {e}")
                log_entry['event_data'] = {'raw': log_entry['event_data']}
            
            logs.append(log_entry)
        
        return logs
        
    finally:
        conn.close()


def organize_logs_by_task(logs: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Organize logs by task number and system.
    
    Args:
        logs: List of log entries
        
    Returns:
        Dictionary with keys like "systemA_task1" containing relevant logs
    """
    organized = defaultdict(list)
    
    for log in logs:
        event_data = log.get('event_data', {})
        
        # Extract task number and system from event_data
        task_number = event_data.get('taskNumber', 'unknown')
        system = event_data.get('system', 'unknown')
        
        # Create key for this task/system combination
        key = f"system{system}_task{task_number}"
        
        # Create a clean log entry
        clean_log = {
            'id': log['id'],
            'timestamp': log['timestamp'],
            'message': log['message'],
            'event_data': event_data,
            'created_at': log['created_at']
        }
        
        organized[key].append(clean_log)
    
    return dict(organized)


def save_task_logs(
    user_id: str,
    task_logs: Dict[str, List[Dict[str, Any]]],
    output_dir: str,
    pretty: bool = False
) -> List[str]:
    """
    Save task logs to separate JSON files.
    
    Args:
        user_id: User ID for file naming
        task_logs: Dictionary of logs organized by task
        output_dir: Directory to save files
        pretty: Whether to pretty print JSON
        
    Returns:
        List of created file paths
    """
    # Create base output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Create participant-specific folder
    user_folder = output_path / user_id
    user_folder.mkdir(parents=True, exist_ok=True)
    
    # Use participant folder as the actual output path
    output_path = user_folder
    
    created_files = []
    
    for task_key, logs in sorted(task_logs.items()):
        # Create filename: P1_systemA_task1.json
        filename = f"{user_id}_{task_key}.json"
        filepath = output_path / filename
        
        # Prepare output data with metadata
        output_data = {
            'user_id': user_id,
            'task': task_key,
            'log_count': len(logs),
            'logs': logs
        }
        
        # Write to file
        with open(filepath, 'w') as f:
            if pretty:
                json.dump(output_data, f, indent=2, sort_keys=True)
            else:
                json.dump(output_data, f)
        
        created_files.append(str(filepath))
        print(f"Created: {filepath} ({len(logs)} logs)")
    
    return created_files


def print_summary(user_id: str, task_logs: Dict[str, List[Dict[str, Any]]]):
    """Print a summary of the extracted logs."""
    print(f"\n{'='*50}")
    print(f"Summary for user {user_id}")
    print(f"{'='*50}")
    
    total_logs = sum(len(logs) for logs in task_logs.values())
    print(f"Total logs: {total_logs}")
    print(f"Unique task/system combinations: {len(task_logs)}")
    
    print(f"\nLogs per task:")
    for task_key in sorted(task_logs.keys()):
        print(f"  {task_key}: {len(task_logs[task_key])} logs")
    
    # Show event types distribution
    event_types = defaultdict(int)
    for logs in task_logs.values():
        for log in logs:
            event_types[log['message']] += 1
    
    print(f"\nEvent types:")
    for event_type, count in sorted(event_types.items(), key=lambda x: x[1], reverse=True):
        print(f"  {event_type}: {count}")


def main():
    """Main execution function."""
    args = parse_arguments()
    
    # Check if database exists
    db_path = Path(args.db)
    if not db_path.exists():
        print(f"Error: Database file '{args.db}' not found")
        sys.exit(1)
    
    print(f"Extracting logs for user: {args.user_id}")
    print(f"From database: {args.db}")
    
    # Get logs from database
    logs = get_user_logs(str(db_path), args.user_id)
    
    if not logs:
        print(f"No logs found for user {args.user_id}")
        sys.exit(0)
    
    print(f"Found {len(logs)} total logs")
    
    # Organize logs by task
    task_logs = organize_logs_by_task(logs)
    
    # Save to files
    created_files = save_task_logs(
        args.user_id,
        task_logs,
        args.output_dir,
        args.pretty
    )
    
    # Print summary
    print_summary(args.user_id, task_logs)
    
    print(f"\n{'='*50}")
    print(f"Successfully created {len(created_files)} files in {args.output_dir}")


if __name__ == "__main__":
    main()