import json
import sqlite3
import sys

def sql_to_json(query_string):
    try:
        conn = sqlite3.connect(':memory:')
        c = conn.cursor()
        statements = query_string.split(';')
        result_sets = []
        table_names = []
        for statement in statements:
            c.execute(statement)
            if 'SELECT' in statement or 'select' in statement:
                column_names = [desc[0] for desc in c.description]
                table_name = statement.lower().split('from')[1].split()[0]
                rows = c.fetchall()
                results = [dict(zip(column_names, row)) for row in rows]
                result_sets.append(results)
                table_names.append(table_name)

        # Create a dictionary of result sets keyed by table names
        results_dict = {}
        for i in range(len(table_names)):
            results_dict[table_names[i]] = result_sets[i]

        # Convert the dictionary to a JSON object
        json_data = json.dumps(results_dict)

        # Print the JSON object to the console
        print(json_data)

        # Delete the database
        conn.close()

        return json_data

    except Exception as e:
        error_message = f"Error executing SQL query: {e}"
        print(error_message)
        return error_message

if __name__ == '__main__':
    query_string = sys.argv[1]
    sql_to_json(query_string)
    conn = sqlite3.connect(':memory:')
    conn.execute("pragma writable_schema = 1")
    conn.execute("delete from sqlite_master where type in ('table', 'index', 'trigger')")
    conn.execute("pragma writable_schema = 0")
    conn.close()
